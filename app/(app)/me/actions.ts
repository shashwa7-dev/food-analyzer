"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { allows } from "@/lib/credits/plans";
import { deleteAccount, ProfileUpdateSchema, updateProfile } from "@/lib/profile/service";

export async function saveProfile(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const { userId, profile } = await requireUser();
  const parsed = ProfileUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Some values are out of range." };
  // Custom daily targets are Pro-only once PRO_GATES_ENFORCED is on; going back to the presets (null) is always allowed.
  if (parsed.data.targets && !allows(profile.plan, "customTargets")) return { ok: false, message: "Custom targets are part of Pro." };
  await updateProfile(userId, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAccountAction(confirmText: string) {
  const { userId } = await requireUser();
  if (confirmText !== "DELETE") return { ok: false as const, message: "Type DELETE to confirm." };
  await auth.api.signOut({ headers: await headers() }).catch(() => undefined);
  await deleteAccount(userId);
  redirect("/");
}
