import { z } from "zod";
import type { Meal } from "@/lib/nutrition/types";

export function todayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function parse(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date ? null : d;
}

/** The meal a log most likely belongs to at this local hour (breakfast < 11, lunch < 16, snack < 19, else dinner). */
export function defaultMealIn(tz: string, now: Date = new Date()): Meal {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: tz }).format(now)) % 24;
  return hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 19 ? "snack" : "dinner";
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

// For UI widgets (e.g. a calendar picker) that build native Date objects from a
// YYYY-MM-DD string and read them back with local getters. Unlike `parse` above (which
// anchors at UTC midnight for day-arithmetic), these use the host's local timezone on
// both ends, so round-tripping through them never shifts the calendar day.
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
