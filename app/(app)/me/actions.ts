"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { allows } from "@/lib/credits/plans";
import { gatedTargetsWrite } from "@/lib/profile/targets-gate";
import { deleteAccount, dismissNotice, NOTICE_KEYS, ProfileUpdateSchema, updateProfile } from "@/lib/profile/service";
import { deleteUserPhotos } from "@/lib/scans/photo-storage";

export async function saveProfile(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const { userId, profile } = await requireUser();
  const parsed = ProfileUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Some values are out of range." };
  const data = { ...parsed.data };
  // Custom daily targets are Pro-only once PRO_GATES_ENFORCED is on. Going back to the presets (null, or
  // the goal's own values) is always allowed, and so is re-sending the targets already stored, so a
  // Basic user who set targets before the gates can still finish a redone onboarding.
  if (data.targets && !allows(profile.plan, "customTargets")) {
    const write = gatedTargetsWrite(data.targets, profile.targets, data.goal ?? profile.goal);
    if (write === "custom") return { ok: false, message: "Custom targets are part of Pro." };
    if (write === "unchanged") delete data.targets;
    else data.targets = null;
  }
  await updateProfile(userId, data);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Dismisses a one-time notice for good (the targets-reset notice on Today and Me). */
export async function dismissNoticeAction(key: unknown): Promise<void> {
  const { userId } = await requireUser();
  const parsed = z.enum(NOTICE_KEYS).safeParse(key);
  if (!parsed.success) return;
  await dismissNotice(userId, parsed.data);
  revalidatePath("/", "layout");
}

export async function deleteAccountAction(confirmText: string) {
  const { userId } = await requireUser();
  if (confirmText !== "DELETE") return { ok: false as const, message: "Type DELETE to confirm." };
  // Scan photos go first, while the user is still signed in, so a storage error is an answer they can
  // retry instead of a signed-out dead end; deleteAccount then skips that step (photosDeleted) and only
  // runs its best-effort sweep after the commit.
  try {
    await deleteUserPhotos(userId);
  } catch (err) {
    console.error("deleteUserPhotos failed", err);
    return { ok: false as const, message: "Couldn't delete your account. Try again." };
  }
  await auth.api.signOut({ headers: await headers() }).catch(() => undefined);
  await deleteAccount(userId, new Date(), { photosDeleted: true });
  redirect("/");
}
