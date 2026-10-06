export interface FoodHit {
  id: string; name: string; brand: string | null; kind: string; grade: string | null; source: string;
  defaultPortion: { label: string; grams: number | null; kcal: number | null };
}
