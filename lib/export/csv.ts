// CSV for the data export (spec §B): RFC 4180 quoting and CRLF line ends, plus a guard against
// formula injection — a text cell starting with = + - @ (or tab / CR) is prefixed with ' so a
// spreadsheet shows it as text instead of running it. Numbers are written as they are.

export type CsvColumn<T> = { key: keyof T & string; header: string };

const FORMULA_LEAD = /^[=+\-@\t\r]/;

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (FORMULA_LEAD.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function csvLine(values: unknown[]): string {
  return `${values.map(cell).join(",")}\r\n`;
}

/** A header row of `columns`' headers, then one line per row in column order. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  return csvLine(columns.map((c) => c.header)) + rows.map((r) => csvLine(columns.map((c) => r[c.key]))).join("");
}
