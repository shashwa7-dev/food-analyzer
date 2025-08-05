interface NutritionCardProps {
  label: string;
  value: string;
  size?: "sm" | "md" | "lg";
}

const NutritionCard: React.FC<NutritionCardProps> = ({
  label,
  value,
  size = "md",
}) => {
  const sizeClasses = {
    sm: "p-2 text-xs",
    md: "p-4 text-sm",
    lg: "p-4 text-lg",
  };

  const valueClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-xl",
  };

  return (
    <div
      className={`bg-card rounded-lg text-center border border-border ${sizeClasses[size]}`}
    >
      <p className="text-muted-foreground font-medium">{label}</p>
      <p className={`font-bold text-card-foreground ${valueClasses[size]}`}>
        {value}
      </p>
    </div>
  );
};

export default NutritionCard;
