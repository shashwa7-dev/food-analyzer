import type { Flag, Reason } from "@/lib/nutrition/types";

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

/** Allergen and diet flags in a bad-bordered box; goal notes on accent-soft. */
export function FlagList({ flags }: { flags: Flag[] }) {
  return (
    <>
      {flags.map((f) => (
        <div key={f.type + f.key} role={f.type === "goal" ? undefined : "alert"}
          className={`rounded-md border p-3.5 text-sm ${f.type === "goal" ? "border-line bg-accent-soft" : "border-bad"}`}>
          {f.text}
        </div>
      ))}
    </>
  );
}
