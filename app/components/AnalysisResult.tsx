import React from "react";

interface AnalysisResultProps {
  isLoading: boolean;
  uploadedImage: string | null;
  healthScore: number;
  concerns: string[];
  recommendedPortion: string;
  nutritionPerPortion: {
    calories: string;
    protein: string;
    carbs: string;
  };
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({
  isLoading,
  uploadedImage,
  healthScore,
  concerns,
  recommendedPortion,
  nutritionPerPortion,
}) => {
  const getHealthColor = (index: number) => {
    if (index < 3) return "bg-red-500";
    if (index < 7) return "bg-yellow-500";
    return "bg-green-500";
  };

  const renderHealthMeter = (score: number) => {
    return (
      <div className="flex items-center space-x-1">
        {[...Array(10)].map((_, index) => (
          <div
            key={index}
            className={`w-4 h-4 rounded-full ${
              index < score ? getHealthColor(score) : "bg-gray-300"
            }`}
          />
        ))}
        <span className="ml-2 font-semibold">{score}/10</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-8 text-center">
        <p className="text-xl font-semibold">Analyzing image... Please wait.</p>
      </div>
    );
  }

  if (!uploadedImage) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-8">
      <div className="flex flex-col md:flex-row">
        <div className="md:w-1/3 pr-4">
          <h2 className="text-2xl font-bold mb-4">Product</h2>
          <img
            src={uploadedImage}
            alt="Uploaded food product"
            className="w-full h-64 object-cover rounded-lg shadow-lg"
          />
        </div>
        <div className="md:w-2/3 mt-4 md:mt-0">
          <h2 className="text-2xl font-bold mb-4">Analysis Result</h2>
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Health Score:</h3>
            {renderHealthMeter(healthScore)}
          </div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Health Concerns:</h3>
            <ul className="list-disc pl-5">
              {concerns.map((concern, index) => (
                <li key={index} className="text-gray-700">
                  {concern}
                </li>
              ))}
            </ul>
          </div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Recommended Portion:</h3>
            <p className="text-gray-700">{recommendedPortion}</p>
          </div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">
              Nutrition Per Recommended Portion:
            </h3>
            <p className="text-gray-700">
              Calories: {nutritionPerPortion.calories}
            </p>
            <p className="text-gray-700">
              Protein: {nutritionPerPortion.protein}
            </p>
            <p className="text-gray-700">Carbs: {nutritionPerPortion.carbs}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResult;
