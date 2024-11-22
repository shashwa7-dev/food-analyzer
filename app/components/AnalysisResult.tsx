import React from "react";

interface AnalysisResultProps {
  productName: string;
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
  productName,
  healthScore,
  concerns,
  recommendedPortion,
  nutritionPerPortion,
}) => {
  const getHealthColor = (score: number) => {
    if (score < 3) return "bg-red-500";
    if (score < 7) return "bg-yellow-500";
    return "bg-green-500";
  };

  const renderHealthMeter = (score: number) => {
    return (
      <div className="flex items-center space-x-1">
        {[...Array(10)].map((_, index) => (
          <div
            key={index}
            className={`w-2 h-4 rounded-sm ${
              index < score ? getHealthColor(score) : "bg-gray-300"
            }`}
          />
        ))}
        <span className="ml-2 font-semibold">{score}/10</span>
      </div>
    );
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 text-indigo-600">{productName}</h2>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="font-semibold">Health Score:</p>
          {renderHealthMeter(healthScore)}{" "}
          <div className="mt-2">
            <p className="font-semibold text-sm">Recommended Portion:</p>
            <p>{recommendedPortion}</p>
            <p className="text-sm">Calories: {nutritionPerPortion.calories}</p>
            <p className="text-sm">Protein: {nutritionPerPortion.protein}</p>

            <p className="text-sm">
              Carbs:
              {/* @ts-ignore */}
              {nutritionPerPortion.carbs ?? nutritionPerPortion?.carbohydrates}
            </p>
          </div>
        </div>
        <div>
          <p className="font-semibold">Health Concerns:</p>
          <ul className="list-disc pl-5">
            {concerns.map((concern, index) => (
              <li key={index} className="text-sm">
                {concern}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResult;
