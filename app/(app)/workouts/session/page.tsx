import { requireUser } from "@/lib/session";
import { LiveSession } from "@/components/fitness/session/live-session";
import { PRESET_KEYS, type Preset } from "@/lib/fitness/types";

/**
 * The live gym session (spec §C screen 2). `?preset=push` starts that preset, `?preset=empty` an
 * empty session; with no `?preset=` an existing draft simply resumes (or an empty session starts).
 */
export default async function WorkoutSessionPage({ searchParams }: { searchParams: Promise<{ preset?: string | string[] }> }) {
  const { userId, profile } = await requireUser();
  const raw = (await searchParams).preset;
  const value = Array.isArray(raw) ? raw[0] : raw;
  // undefined = no preference (resume whatever is in progress); null = an empty session.
  const preset: Preset | null | undefined =
    value === undefined ? undefined : (PRESET_KEYS as readonly string[]).includes(value) ? (value as Preset) : null;
  return <LiveSession userId={userId} timezone={profile.timezone} requested={preset} />;
}
