import type { Reason } from "@/lib/nutrition/types";

const TONE_DOT: Record<Reason["tone"], string> = { good: "bg-ok", warn: "bg-warn", bad: "bg-bad" };

export function ReasonList({ reasons }: { reasons: Reason[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {reasons.map((r) => (
        <li key={r.text} className="flex items-start gap-2.5">
          <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${TONE_DOT[r.tone]}`} aria-hidden />
          {r.text}
        </li>
      ))}
    </ul>
  );
}
