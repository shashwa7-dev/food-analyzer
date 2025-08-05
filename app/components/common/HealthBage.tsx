interface HealthBadgeProps {
  score: number;
  size?: "sm" | "md";
}

const HealthBadge: React.FC<HealthBadgeProps> = ({ score, size = "md" }) => {
  const getHealthColor = (score: number) => {
    if (score < 2) return "text-health-very-poor bg-health-very-poor/10";
    if (score < 4) return "text-health-poor bg-health-poor/10";
    if (score < 6) return "text-health-fair bg-health-fair/10";
    if (score < 8) return "text-health-good bg-health-good/10";
    return "text-health-excellent bg-health-excellent/10";
  };

  const getHealthLabel = (score: number) => {
    if (score < 2) return "Very Poor";
    if (score < 4) return "Poor";
    if (score < 6) return "Fair";
    if (score < 8) return "Good";
    return "Excellent";
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1 text-sm",
  };

  return (
    <div
      className={`rounded-full font-medium w-fit ${getHealthColor(score)} ${
        sizeClasses[size]
      }`}
    >
      {score}/10 - {getHealthLabel(score)}
    </div>
  );
};

export default HealthBadge;
