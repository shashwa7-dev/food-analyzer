import type { Nutrients, Portion } from "@/lib/nutrition/types";

export interface SourceRecord {
  source: "indb" | "fndds" | "off";
  sourceRef: string; // INDB food_code, FNDDS fdcId, OFF barcode
  name: string;
  brand?: string;
  barcode?: string;
  basis: "per_100g" | "per_100ml";
  per100: Nutrients;
  portions: Portion[]; // as given by the source (no 100 g base yet)
  wweia?: string; // FNDDS only
  categories?: string[]; // OFF only
  ingredients?: string[];
  allergens?: string[];
  mayContain?: string[]; // OFF traces_tags
  additives?: string[];
  nova?: number | null;
  nutriscore?: string | null;
  imageUrl?: string;
  countries: string[]; // ISO alpha-2
}
