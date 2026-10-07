"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { joinWaitlist } from "@/lib/credits/waitlist";

export async function joinWaitlistAction() {
  const { userId } = await requireUser();
  await joinWaitlist(userId);
  revalidatePath("/me/credits");
}
