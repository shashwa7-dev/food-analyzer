import { z } from "zod";

export function todayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function parse(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date ? null : d;
}

export function addDays(date: string, n: number): string {
  const d = parse(date);
  if (!d) throw new Error(`invalid date ${date}`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isAllowedLogDate(date: string, now: Date = new Date()): boolean {
  if (!parse(date)) return false;
  const today = now.toISOString().slice(0, 10);
  return date >= addDays(today, -365) && date <= addDays(today, 1);
}

export const DateSchema = z.string().refine((d) => isAllowedLogDate(d), { message: "Pick a date within the last year." });
