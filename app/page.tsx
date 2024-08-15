"use client";
import { useState } from "react";
import Head from "next/head";
import ImageUpload from "./components/ImageUpload";
import AnalysisResult from "./components/AnalysisResult";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY as string
);

const analyzeImage = async (file: File) => {
  try {
    const base64Image = await fileToBase64(file);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze this image of a food product's nutrition label and ingredients list. Provide the following information:
    1. The product name.
    2. The expiry date (if visible).
    3. A health score from 0 (very unhealthy) to 10 (very healthy).
    4. List any concerning ingredients or nutritional aspects.
    5. Recommend a portion size for consumption.
    6. Provide calories, protein, and carbs for the recommended portion size. Ensure units are accurate (e.g., kcal, g).
    7. If the nutrition information is given per 100g, calculate it for the recommended portion.
    Format the response as a JSON object with keys 'productName', 'expiryDate', 'healthScore', 'concerns', 'recommendedPortion', and 'nutritionPerPortion'.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image.split(",")[1],
        },
      },
      prompt,
    ]);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const analysisResult = JSON.parse(jsonMatch[1]);

    return {
      productName: analysisResult.productName || "Unknown Product",
      expiryDate: analysisResult.expiryDate || "Not available",
      healthScore: analysisResult.healthScore,
      concerns: analysisResult.concerns,
      recommendedPortion: analysisResult.recommendedPortion,
      nutritionPerPortion: analysisResult.nutritionPerPortion,
    };
  } catch (error) {
    console.error("Error analyzing image:", error);
    return {
      productName: "Error",
      expiryDate: "N/A",
      healthScore: 0,
      concerns: ["Error analyzing image"],
      recommendedPortion: "N/A",
      nutritionPerPortion: { calories: "N/A", protein: "N/A", carbs: "N/A" },
    };
  }
};
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export default function Home() {
  const [result, setResult] = useState<any>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleImageUpload = async (file: File) => {
    setIsLoading(true);
    setUploadedImage(URL.createObjectURL(file));
    const analysis = await analyzeImage(file);
    setResult(analysis);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen">
      <Head>
        <title>Food Analyzer</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-center mb-8">Food Analyzer</h1>
        <ImageUpload onImageUpload={handleImageUpload} />
        <AnalysisResult
          isLoading={isLoading}
          uploadedImage={uploadedImage}
          healthScore={result?.healthScore || 0}
          concerns={result?.concerns || []}
          recommendedPortion={result?.recommendedPortion || ""}
          nutritionPerPortion={
            result?.nutritionPerPortion || {
              calories: "",
              protein: "",
              carbs: "",
            }
          }
        />
      </main>
    </div>
  );
}
