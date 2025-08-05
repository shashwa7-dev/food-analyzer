"use client";
import { dataUtils } from "@/lib/utils";
import SectionContainer from "./SectionContainer";
import SectionHeader from "./SectionHeader";
import HealthMeter from "../common/HealthMeter";
import NutritionCard from "../common/NutritionCard";
import ConcernsSummary from "../common/ConcernSummary";

interface AnalysisResultProps {
  productName: string;
  healthScore: number;
  concerns: string[];
  recommendedPortion: any;
  nutritionPerPortion: any;
  expiryDate?: string;
  scanId?: string;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({
  productName,
  healthScore,
  concerns,
  recommendedPortion,
  nutritionPerPortion,
  expiryDate,
  scanId,
}) => {
  // Process data using shared utilities
  const safeHealthScore = dataUtils.getSafeHealthScore(healthScore);
  const safeConcerns = dataUtils.getSafeConcerns(concerns);
  const safeProductName = dataUtils.safeGet(productName, "Unknown Product");

  // Get all available nutrition keys for dynamic display
  const getAllNutritionKeys = (): string[] => {
    if (!nutritionPerPortion || typeof nutritionPerPortion !== "object") {
      return [];
    }
    return Object.keys(nutritionPerPortion);
  };

  // Core nutrition keys to always show
  const coreNutritionKeys = ["calories", "protein", "carbs"];

  // Additional nutrition keys that might be present
  const additionalKeys = getAllNutritionKeys().filter(
    (key) =>
      !coreNutritionKeys.some(
        (coreKey) =>
          key.toLowerCase().includes(coreKey.toLowerCase()) ||
          coreKey.toLowerCase().includes(key.toLowerCase())
      )
  );

  // Validation for critical data
  if (!nutritionPerPortion || typeof nutritionPerPortion !== "object") {
    return (
      <div className="max-w-4xl mx-auto bg-background overflow-hidden">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 m-4">
          <h3 className="text-lg font-semibold text-destructive mb-2">
            Invalid Data
          </h3>
          <p className="text-destructive/80">
            The analysis data appears to be incomplete or invalid. Please try
            scanning again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-background overflow-hidden max-h-[40dvh] overflow-y-auto">
      {/* Header */}
      <div className="bg-accent p-3 sticky top-0">
        <h2 className="text-xl font-bold text-foreground">{safeProductName}</h2>
        {/* {expiryDate &&
          expiryDate !== "Not available" &&
          expiryDate !== "Not visible" && (
            <p className="text-xs  mt-1">Expires: {expiryDate}</p>
          )} */}
        {scanId && <p className="text-xs mt-1">Scan ID: {scanId}</p>}
      </div>

      {/* Content */}
      <div className="grid gap-4 p-3">
        {/* Health Score Section */}
        <SectionContainer>
          <SectionHeader title="Health Score" color="bg-section-health" />
          <HealthMeter score={safeHealthScore} />
        </SectionContainer>

        {/* Nutrition Information */}
        <SectionContainer>
          <SectionHeader
            title="Recommended Portion"
            color="bg-section-nutrition"
          />
          <div className="space-y-4">
            <div className="bg-card rounded-lg p-4 border-l-4 border-section-nutrition">
              <p className="text-2xl font-bold text-section-nutrition">
                {dataUtils.formatRecommendedPortion(recommendedPortion)}
              </p>
            </div>

            {/* Core Nutrition Facts */}
            <div className="grid grid-cols-3 gap-4">
              {coreNutritionKeys.map((key) => (
                <NutritionCard
                  key={key}
                  label={dataUtils.formatKeyName(key)}
                  value={dataUtils.getNutritionValue(nutritionPerPortion, key)}
                />
              ))}
            </div>

            {/* Additional Nutrition Facts (if any) */}
            {additionalKeys.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-2">
                  Additional Nutrition
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {additionalKeys.slice(0, 6).map((key) => (
                    <NutritionCard
                      key={key}
                      label={dataUtils.formatKeyName(key)}
                      value={dataUtils.extractValue(nutritionPerPortion[key])}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionContainer>

        {/* Health Concerns Information */}
        <SectionContainer bgColor="bg-muted/20">
          <SectionHeader
            title="Health Concerns"
            color="bg-section-concerns"
            badge={safeConcerns.length}
          />
          <div className="space-y-3">
            {safeConcerns.length > 0 ? (
              <ConcernsSummary concerns={safeConcerns} />
            ) : (
              <div className="bg-health-excellent/10 border border-health-excellent/30 rounded-lg p-4 text-center">
                <p className="text-health-excellent font-medium">
                  No major health concerns identified!
                </p>
              </div>
            )}
          </div>
        </SectionContainer>
      </div>

      {/* Footer */}
      <div className="bg-muted p-3 border-t border-border">
        <p className="text-sm text-muted-foreground text-center">
          Analysis based on nutritional content. Individual dietary needs may
          vary.
        </p>
      </div>
    </div>
  );
};

export default AnalysisResult;
