export const dataUtils = {
  // Universal value extractor that works with any format
  extractValue: (data: any): string => {
    if (data === null || data === undefined) return "N/A";

    // Handle object with value/unit structure: {value: 149.1, unit: "kcal"}
    if (typeof data === "object" && data.value !== undefined) {
      const value = data.value;
      const unit = data.unit || "";
      return unit ? `${value} ${unit}` : String(value);
    }

    // Handle object with amount/unit structure: {amount: 1, unit: "bar"}
    if (typeof data === "object" && data.amount !== undefined) {
      const amount = data.amount;
      const unit = data.unit || "";
      return unit ? `${amount} ${unit}` : String(amount);
    }

    // Handle plain string or number
    if (typeof data === "string" || typeof data === "number") {
      return String(data);
    }

    // Handle any other object - try to extract meaningful info
    if (typeof data === "object") {
      // Look for common property names
      const commonProps = ["value", "amount", "quantity", "val"];
      for (const prop of commonProps) {
        if (data[prop] !== undefined) {
          const unit = data.unit || data.units || "";
          return unit ? `${data[prop]} ${unit}` : String(data[prop]);
        }
      }
    }

    return "N/A";
  },

  // Format recommended portion from any structure
  formatRecommendedPortion: (portion: any): string => {
    try {
      if (!portion) return "Not specified";

      // Handle {value: 30, unit: "g"}
      if (typeof portion === "object" && portion.value !== undefined) {
        const value = portion.value;
        const unit = portion.unit || "";
        return unit ? `${value} ${unit}` : String(value);
      }

      // Handle {amount: 1, unit: "bar", grams: 45}
      if (typeof portion === "object" && portion.amount !== undefined) {
        const amount = portion.amount;
        const unit = portion.unit || "";
        const grams = portion.grams;

        let result = unit ? `${amount} ${unit}` : String(amount);
        if (grams) result += ` (${grams}g)`;
        return result;
      }

      // Handle string format
      if (typeof portion === "string") {
        return portion;
      }

      // Handle any other format
      return dataUtils.extractValue(portion);
    } catch (error) {
      console.warn("Error formatting recommended portion:", error);
      return "Not specified";
    }
  },

  // Get nutrition value with flexible key lookup
  getNutritionValue: (nutritionData: any, key: string): string => {
    if (!nutritionData || typeof nutritionData !== "object") {
      return "N/A";
    }

    // Try exact key match first
    if (nutritionData[key] !== undefined) {
      return dataUtils.extractValue(nutritionData[key]);
    }

    // Try common alternative names
    const alternatives: { [key: string]: string[] } = {
      calories: ["calorie", "cal", "energy", "kcal"],
      protein: ["proteins", "prot"],
      carbs: ["carbohydrates", "carb", "carbohydrate"],
      fat: ["fats", "totalFat", "total_fat"],
      sodium: ["salt", "na"],
      fiber: ["fibre", "dietary_fiber", "dietaryFiber"],
    };

    if (alternatives[key]) {
      for (const alt of alternatives[key]) {
        if (nutritionData[alt] !== undefined) {
          return dataUtils.extractValue(nutritionData[alt]);
        }
      }
    }

    return "N/A";
  },

  // Format key names for display
  formatKeyName: (key: string): string => {
    return key
      .replace(/([A-Z])/g, " $1") // Add space before capital letters
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .replace(/_/g, " "); // Replace underscores with spaces
  },

  // Safe getter with fallback
  safeGet: (value: any, fallback: string = "N/A"): string => {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }
    return String(value);
  },

  // Health score utilities
  getSafeHealthScore: (score: number): number => {
    const numScore = Number(score);
    if (isNaN(numScore) || numScore < 0) return 0;
    if (numScore > 10) return 10;
    return Math.round(numScore);
  },

  getSafeConcerns: (concerns: any): string[] => {
    if (Array.isArray(concerns)) {
      return concerns.filter(
        (concern) => typeof concern === "string" && concern.trim().length > 0
      );
    }
    if (typeof concerns === "string" && concerns.trim().length > 0) {
      return [concerns];
    }
    return [];
  },

  // Format date utility
  formatDate: (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },
};

export const debounce = <T extends unknown[]>(
  func: (...args: T) => void,
  wait: number
) => {
  let timeout: NodeJS.Timeout | undefined;

  return (...args: T) => {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
