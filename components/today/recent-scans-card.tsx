import { useId } from "react";
import Link from "next/link";
import { AlertCircle, Barcode, FileText, History, Loader2, Package, ScanLine, Soup, type LucideIcon } from "lucide-react";
import { GradeBadge } from "@/components/grade-badge";
import { RailCard, RailCardHead, RailCardLink } from "@/components/today/rail-card";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { isScanFailed, isScanRunning, recentScanMeta, scanTitle } from "@/lib/scans/history";
import type { ScanListItem } from "@/lib/scans/service";

const KIND_ICON: Record<NonNullable<ScanListItem["inputKind"]>, LucideIcon> = { barcode: Barcode, label: FileText, front: Package, meal: Soup };

/**
 * The row's right edge: the grade (or the provisional "?"), a spinner while running, or the failure
 * icon. The title already says "Analysing…" or "Scan failed", so the icons are decorative.
 */
function Status({ s }: { s: ScanListItem }) {
  if (isScanRunning(s)) return <Loader2 className="size-[18px] shrink-0 animate-spin text-subtle motion-reduce:animate-none" aria-hidden />;
  if (isScanFailed(s)) return <AlertCircle className="size-[18px] shrink-0 text-bad" aria-hidden />;
  return <GradeBadge grade={s.grade} size="sm" />;
}

/**
 * Recent scans (mock-c1 option A): the last three visible scans, each a 44 px row linking to the
 * scan with its input-kind icon, name and "Barcode · free" / "Label" / "Meal photo"; otherwise a
 * centred empty state with a Scan food pill.
 */
export function RecentScansCard({ scans }: { scans: ScanListItem[] }) {
  const titleId = useId();
  return (
    <RailCard labelledBy={titleId}>
      <RailCardHead id={titleId} icon={History} title="Recent scans">
        {scans.length > 0 && <RailCardLink href="/history">History</RailCardLink>}
      </RailCardHead>
      {scans.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <IconTile tone="brand" size="md"><ScanLine /></IconTile>
          <div className="leading-snug">
            <p className="m-0 text-[15px] font-semibold text-ink">No scans yet</p>
            <p className="m-0 mt-0.5 text-[13px] text-subtle">Scan a barcode or label to see it here.</p>
          </div>
          <Button render={<Link href="/scan" />} nativeButton={false} shape="pill" size="lg" className="px-5">
            <ScanLine aria-hidden />
            Scan food
          </Button>
        </div>
      ) : (
        <ul className="m-0 grid list-none divide-y divide-line p-0">
          {scans.map((s) => {
            const Icon = s.inputKind ? KIND_ICON[s.inputKind] : ScanLine;
            const meta = recentScanMeta(s);
            return (
              <li key={s.id}>
                <Link
                  href={`/scans/${s.id}`}
                  className="-mx-2 flex min-h-[54px] items-center gap-2.5 rounded-[14px] px-2 py-1.5 transition-colors hover:bg-sunken/60"
                >
                  <IconTile size="sm"><Icon /></IconTile>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold text-ink">{scanTitle(s)}</span>
                    {meta && <span className="mt-0.5 block truncate text-[12.5px] text-subtle">{meta}</span>}
                  </span>
                  <Status s={s} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </RailCard>
  );
}
