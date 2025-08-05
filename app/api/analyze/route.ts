import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY as string
);

// Rate limiting storage (in production, use Redis or database)
const requestTracker = new Map<string, { count: number; resetTime: number }>();

// File paths
const SCANNED_RESULTS_FILE = path.join(
  process.cwd(),
  "data",
  "scanned-results.txt"
);

// Ensure data directory exists
const ensureDataDirectory = () => {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Rate limiting function
const checkRateLimit = (clientId: string): boolean => {
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;

  const clientData = requestTracker.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    // Reset or initialize counter
    requestTracker.set(clientId, {
      count: 1,
      resetTime: now + hourInMs,
    });
    return true;
  }

  if (clientData.count >= 5) {
    return false; // Rate limit exceeded
  }

  clientData.count++;
  return true;
};

// Save scanned result to file
const saveScannedResult = (result: any) => {
  try {
    ensureDataDirectory();

    const timestamp = new Date().toISOString();
    const dataEntry = {
      timestamp,
      ...result,
    };

    const dataLine = JSON.stringify(dataEntry) + "\n";

    // Append to file
    fs.appendFileSync(SCANNED_RESULTS_FILE, dataLine, "utf8");
  } catch (error) {
    console.error("Error saving scanned result:", error);
  }
};

// Get client identifier (IP address or user agent)
const getClientId = (request: NextRequest): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0]
    : request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "";
  return `${ip}-${userAgent.substring(0, 50)}`; // Truncate user agent
};

const fileToBase64 = (buffer: ArrayBuffer): string => {
  return Buffer.from(buffer).toString("base64");
};

// Validate file size (500KB = 500 * 1024 bytes)
const validateFileSize = (file: File): boolean => {
  const maxSize = 500 * 1024; // 500KB in bytes
  return file.size <= maxSize;
};

export async function POST(request: NextRequest) {
  try {
    // Get client identifier for rate limiting
    const clientId = getClientId(request);

    // Check rate limit
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Maximum 5 requests per hour allowed.",
          resetTime: requestTracker.get(clientId)?.resetTime,
        },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file size
    if (!validateFileSize(file)) {
      return NextResponse.json(
        { error: "File size exceeds 500KB limit" },
        { status: 413 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const base64Image = fileToBase64(buffer);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Analyze this image of a food product's nutrition label and ingredients list. Provide the following information:
    1. The product name.
    2. The expiry date (if visible).
    3. A health score from 0 (very unhealthy) to 10 (very healthy).
    4. List any concerning ingredients or nutritional aspects.
    5. Recommend a portion size for consumption in appropriate units(g, ml, others).
    6. Provide calories, protein, and carbs for the recommended portion size. Ensure units are accurate (e.g., kcal, g).
    7. If the nutrition information is given per 100g, calculate it for the recommended portion.
    Format the response as a JSON object with keys 'productName', 'expiryDate', 'healthScore', 'concerns', 'recommendedPortion', and 'nutritionPerPortion'.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: file.type,
          data: base64Image,
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const analysisResult = JSON.parse(jsonMatch[1]);

    const responseData = {
      productName: analysisResult.productName || "Unknown Product",
      expiryDate: analysisResult.expiryDate || "Not available",
      healthScore: analysisResult.healthScore,
      concerns: analysisResult.concerns,
      recommendedPortion: analysisResult.recommendedPortion,
      nutritionPerPortion: analysisResult.nutritionPerPortion,
      scanId: Date.now().toString(), // Add unique scan ID
    };

    // Save the scanned result to file
    saveScannedResult(responseData);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error analyzing image:", error);
    return NextResponse.json(
      {
        productName: "Error",
        expiryDate: "N/A",
        healthScore: 0,
        concerns: ["Error analyzing image"],
        recommendedPortion: "N/A",
        nutritionPerPortion: { calories: "N/A", protein: "N/A", carbs: "N/A" },
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    ensureDataDirectory();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const productName = searchParams.get("productName");

    // Check if file exists
    if (!fs.existsSync(SCANNED_RESULTS_FILE)) {
      return NextResponse.json({
        results: [],
        total: 0,
        hasMore: false,
      });
    }

    // Read file and parse results
    const fileContent = fs.readFileSync(SCANNED_RESULTS_FILE, "utf8");
    const lines = fileContent
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);

    let results = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          console.error("Error parsing line:", line, error);
          return null;
        }
      })
      .filter((result) => result !== null);

    // Filter by product name if provided
    if (productName) {
      results = results.filter((result) =>
        result.productName.toLowerCase().includes(productName.toLowerCase())
      );
    }

    // Sort by timestamp (newest first)
    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return NextResponse.json({
      results: paginatedResults,
      total,
      hasMore,
      pagination: {
        limit,
        offset,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error retrieving scanned results:", error);
    return NextResponse.json(
      { error: "Error retrieving scanned results" },
      { status: 500 }
    );
  }
}

// Optional: DELETE endpoint to clear old results
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scanId = searchParams.get("scanId");

    if (!scanId) {
      return NextResponse.json(
        { error: "scanId parameter is required" },
        { status: 400 }
      );
    }

    ensureDataDirectory();

    if (!fs.existsSync(SCANNED_RESULTS_FILE)) {
      return NextResponse.json(
        { error: "No results file found" },
        { status: 404 }
      );
    }

    // Read current results
    const fileContent = fs.readFileSync(SCANNED_RESULTS_FILE, "utf8");
    const lines = fileContent
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);

    const results = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          return null;
        }
      })
      .filter((result) => result !== null);

    // Filter out the result with matching scanId
    const filteredResults = results.filter(
      (result) => result.scanId !== scanId
    );

    if (filteredResults.length === results.length) {
      return NextResponse.json({ error: "Scan ID not found" }, { status: 404 });
    }

    // Write back to file
    const newContent =
      filteredResults.map((result) => JSON.stringify(result)).join("\n") + "\n";
    fs.writeFileSync(SCANNED_RESULTS_FILE, newContent, "utf8");

    return NextResponse.json({
      message: "Result deleted successfully",
      deletedScanId: scanId,
    });
  } catch (error) {
    console.error("Error deleting result:", error);
    return NextResponse.json(
      { error: "Error deleting result" },
      { status: 500 }
    );
  }
}
