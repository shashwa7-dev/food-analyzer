"use client";

import React, { useEffect, useRef, useState } from "react";
import AnalysisResult from "./AnalysisResult";
import ImageUpload from "./ImageUpload";

const analyzeImage = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    return await response.json();
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

const PokedexUI = () => {
  const [result, setResult] = useState<any>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resultHeight, setResultHeight] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const tryNew = () => {
    setResult(null);
    setIsLoading(false);
    setUploadedImage(null);
    setResultHeight(0);
  };

  const handleImageUpload = async (file: File) => {
    setIsLoading(true);
    setUploadedImage(URL.createObjectURL(file));
    const analysis = await analyzeImage(file);
    setResult(analysis);
    setIsLoading(false);
  };

  useEffect(() => {
    if (result && resultRef.current) {
      setResultHeight(resultRef.current.scrollHeight);
    }
  }, [result]);

  return (
    <div className="w-full max-w-2xl mx-auto rounded-xl overflow-hidden">
      <div
        className={
          isLoading
            ? "animated-gradient  p-4 shadow-lg"
            : result
            ? "bg-red-600  p-4 shadow-lg"
            : "bg-red-600 p-4 shadow-lg"
        }
      >
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-blue-400 rounded-full mr-2 border-4 border-white"></div>
          <div className="w-4 h-4 bg-red-400 rounded-full mr-2 border-2 border-white"></div>
          <div className="w-4 h-4 bg-yellow-400 rounded-full mr-2 border-2 border-white"></div>
          <div className="w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
          <div className="flex flex-col gap-0 line-clamp-1 ml-auto">
            <p className="text-xl font-bold text-white  leading-5">EATRi8-AI</p>
            <p className="text-sm font-bold text-white">
              {isLoading ? "analyzing..." : "prod@s7.dev"}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg p-2 relative">
          {uploadedImage ? (
            <img
              src={uploadedImage}
              alt="Uploaded food product"
              className="w-full h-64 object-cover rounded-lg"
            />
          ) : (
            <ImageUpload onImageUpload={handleImageUpload} />
          )}
          {result && (
            <button
              className="absolute bottom-4 right-4 bg-red-600 text-white p-2 px-4 rounded-md text-sm active:scale-95 shadow-lg shadow-red-300 font-bold"
              onClick={tryNew}
            >
              Try new?
            </button>
          )}
        </div>
      </div>
      <div
        ref={resultRef}
        style={{
          height: `${resultHeight}px`,
          transition: "height 0.3s ease-out",
        }}
        className="bg-white shadow-lg  max-h-[40vh] overflow-hidden overflow-y-auto relative"
      >
        {result && !isLoading && (
          <>
            <AnalysisResult {...result} />
            <div className="sticky mt-auto bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          </>
        )}
      </div>
    </div>
  );
};

export default PokedexUI;
