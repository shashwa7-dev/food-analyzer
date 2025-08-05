import { dataUtils } from "@/lib/utils";

interface NutritionGridProps {
  nutritionData: any;
  keys?: string[];
  size?: "sm" | "md";
}

const NutritionGrid: React.FC<NutritionGridProps> = ({
  nutritionData,
  keys = ["calories", "protein", "carbs"],
  size = "md",
}) => {
  const sizeClasses = {
    sm: "p-2 text-xs",
    md: "p-3 text-sm",
  };

  const labelClasses = {
    sm: "text-xs",
    md: "text-xs",
  };

  const valueClasses = {
    sm: "text-xs",
    md: "text-sm",
  };

  return (
    <div className={`grid grid-cols-3 gap-3`}>
      {keys.map((key) => (
        <div
          key={key}
          className={`bg-muted rounded-lg text-center border border-border ${sizeClasses[size]}`}
        >
          <p
            className={`text-muted-foreground font-medium ${labelClasses[size]}`}
          >
            {dataUtils.formatKeyName(key)}
          </p>
          <p className={`font-bold text-foreground ${valueClasses[size]}`}>
            {dataUtils.getNutritionValue(nutritionData, key)}
          </p>
        </div>
      ))}
    </div>
  );
};

export default NutritionGrid;
