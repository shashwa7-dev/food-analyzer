import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY as string
);

const fileToBase64 = (buffer: ArrayBuffer): string => {
  return Buffer.from(buffer).toString("base64");
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64Image = fileToBase64(buffer);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze this image of a food product's nutrition label and ingredients list. Provide the following information:
    1. The product name.
    2. The expiry date (if visible).
    3. A health score from 0 (very unhealthy) to 10 (very healthy).
    4. List any concerning ingredients or nutritional aspects.
    5. Recommend a portion size for consumption in appropriate units(g, ml, others).
    6. Provide calories, protein, and carbs for the recommended portion size. Ensure units are accurate (e.g., kcal, g).
    7. If the nutrition information is given per 100g, calculate it for the recommended portion.
    Format the response as a JSON object with keys 'productName', 'healthScore', 'concerns', 'recommendedPortion', and 'nutritionPerPortion'.`;

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

    return NextResponse.json({
      productName: analysisResult.productName || "Unknown Product",
      expiryDate: analysisResult.expiryDate || "Not available",
      healthScore: analysisResult.healthScore,
      concerns: analysisResult.concerns,
      recommendedPortion: analysisResult.recommendedPortion,
      nutritionPerPortion: analysisResult.nutritionPerPortion,
    });
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
