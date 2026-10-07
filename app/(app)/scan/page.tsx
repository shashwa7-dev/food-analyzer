import { ScanFlow } from "@/components/scan/scan-flow";
import { DateSchema } from "@/lib/dates";
import { normaliseBarcode } from "@/lib/engine/barcode";
import { parseMode } from "@/lib/scans/modes";
import { MEALS, type Meal } from "@/lib/nutrition/types";

type Params = { meal?: string; date?: string; barcode?: string; mode?: string };

// ?meal=&date= come from the Add food sheet (carried through to the result's Add to meal);
// ?barcode= comes back from a "We don't know this barcode" result, so the label photo is sent with it;
// ?mode= picks the first mode tile (food search's barcode button opens on Barcode).
export default async function ScanPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const meal = (MEALS as readonly string[]).includes(sp.meal ?? "") ? (sp.meal as Meal) : null;
  const date = sp.date && DateSchema.safeParse(sp.date).success ? sp.date : null;
  const barcode = sp.barcode ? normaliseBarcode(sp.barcode) : null;
  return <ScanFlow meal={meal} date={date} initialBarcode={barcode} initialMode={parseMode(sp.mode ?? null)} />;
}
