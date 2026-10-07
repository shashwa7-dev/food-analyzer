/** A typed target as a number: "1,800" and " 1800 " both read 1800; "" is "use the preset"; anything else is NaN. */
export function parseTarget(raw: string): number | null {
  const t = raw.replace(/[,\s]/g, "");
  if (t === "") return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}
