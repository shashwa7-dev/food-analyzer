const fmt = (n: number) => `${Math.round(n).toLocaleString("en-IN")} kcal`;

/** The Today headline, split so the page can set `value` in the brand accent (spec §6.1). */
export function headlineFor(p: { eaten: number; target: number; isToday: boolean; dateLabel: string }) {
  const diff = p.target - p.eaten;
  const over = diff < 0;
  if (p.isToday) return { lead: over ? "You're" : "You have", value: fmt(Math.abs(diff)), tail: over ? "over today" : "left today" };
  return { lead: "", value: fmt(Math.abs(diff)), tail: `${over ? "over" : "left"} on ${p.dateLabel}` };
}

// Fixed English names (ICU en-GB/en-IN would give "Sept") so labels are exact on every host.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Wednesday, 7 Oct" and "7 Oct" for a YYYY-MM-DD calendar date (read as UTC, so no day shift). */
export function dayLabels(date: string): { long: string; short: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const short = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return { long: `${WEEKDAYS[d.getUTCDay()]}, ${short}`, short };
}
