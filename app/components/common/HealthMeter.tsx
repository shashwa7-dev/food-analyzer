interface HealthMeterProps {
  score: number;
}

const HealthMeter: React.FC<HealthMeterProps> = ({ score }) => {
  const getHealthColor = (score: number) => {
    if (score < 2) return "bg-health-very-poor/50";
    if (score < 4) return "bg-health-poor/50";
    if (score < 6) return "bg-health-fair/50";
    if (score < 8) return "bg-health-good/50";
    return "bg-health-excellent";
  };

  const getHealthGradient = (score: number) => {
    if (score < 2) return "from-health-very-poor to-health-very-poor/50";
    if (score < 4) return "from-health-poor to-health-poor/50";
    if (score < 6) return "from-health-fair to-health-fair/50";
    if (score < 8) return "from-health-good to-health-good/50";
    return "from-health-excellent to-health-excellent/50";
  };

  const getScoreDescription = (score: number) => {
    if (score < 2) return "Very Poor";
    if (score < 4) return "Poor";
    if (score < 6) return "Fair";
    if (score < 8) return "Good";
    return "Excellent";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-foreground">{score}/10</span>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium text-primary-foreground bg-gradient-to-r ${getHealthGradient(
            score
          )}`}
        >
          {getScoreDescription(score)}
        </span>
      </div>
      <div className="flex items-center space-x-1">
        {[...Array(10)].map((_, index) => (
          <div
            key={index}
            className={`flex-1 h-3 rounded-full transition-all duration-300 ${
              index < score ? `${getHealthColor(score)} shadow-sm` : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HealthMeter;
