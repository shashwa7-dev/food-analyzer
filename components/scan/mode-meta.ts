import { Barcode, Package, ScanText, Soup, type LucideIcon } from "lucide-react";
import type { ScanMode } from "@/lib/scans/modes";

/** Each scan mode's tile label and icon; the scan result's type chip uses the same pair. */
export const MODE_META: Record<ScanMode, { label: string; icon: LucideIcon }> = {
  barcode: { label: "Barcode", icon: Barcode },
  label: { label: "Label", icon: ScanText },
  front: { label: "Front", icon: Package },
  meal: { label: "Meal", icon: Soup },
};

export const MODE_ORDER: ScanMode[] = ["barcode", "label", "front", "meal"];
