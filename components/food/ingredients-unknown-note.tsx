import { InfoIcon } from "lucide-react";

export const INGREDIENTS_UNKNOWN_NOTE = "No ingredient list for this food — we checked allergens from its name only.";

/**
 * INDB/FNDDS foods have no ingredient lists, so personalise() can only check the food's
 * name for allergens. That's worth a quiet caveat to allergy users, but only to them —
 * diet-only users get nothing, and nobody gets a coloured box for it.
 */
export function IngredientsUnknownNote({ ingredientsKnown, hasAllergies }: { ingredientsKnown: boolean; hasAllergies: boolean }) {
  if (ingredientsKnown || !hasAllergies) return null;
  return (
    <p className="flex items-start gap-1.5 text-sm text-subtle">
      <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {INGREDIENTS_UNKNOWN_NOTE}
    </p>
  );
}
