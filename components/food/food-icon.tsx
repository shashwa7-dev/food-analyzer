import { Apple, CupSoda, Cookie, Egg, Milk, Package, Soup, Utensils, Wheat } from "lucide-react";
import { IconTile, type IconTileSize, type IconTileTone } from "@/components/ui/icon-tile";
import type { FoodIconKey } from "@/lib/foods/icon";

/** The lucide icon per food category (also the scan result's category tag). */
export const FOOD_ICON: Record<FoodIconKey, typeof Package> = {
  package: Package,
  drink: CupSoda,
  bowl: Soup,
  wheat: Wheat,
  milk: Milk,
  egg: Egg,
  fruit: Apple,
  snack: Cookie,
  default: Utensils,
};

export function FoodIcon({
  iconKey,
  size = "sm",
  tone = "neutral",
  className,
}: {
  iconKey: FoodIconKey;
  size?: IconTileSize;
  tone?: IconTileTone;
  className?: string;
}) {
  const Icon = FOOD_ICON[iconKey];
  return (
    <IconTile tone={tone} size={size} className={className}>
      <Icon />
    </IconTile>
  );
}
