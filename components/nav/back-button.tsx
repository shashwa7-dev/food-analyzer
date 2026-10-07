"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { backAction, readInAppNav } from "@/lib/nav/back";
import { cn } from "@/lib/utils";

/** The round button on a photo (mock-c1 `.round.on-photo`): near-white whatever the theme. */
export const ON_MEDIA_ROUND = "border-transparent bg-on-media/90 text-on-media-ink hover:bg-on-media";

/**
 * A sub-page's round Back (mock-c1 `.round`): browser back after an in-app navigation, else `fallback`.
 * `onMedia` for one sitting on a photo.
 */
export function BackButton({ fallback, onMedia }: { fallback: string; onMedia?: boolean }) {
  const router = useRouter();
  const back = () => {
    const action = backAction(readInAppNav(), fallback);
    if (action.kind === "back") router.back();
    else router.push(action.href);
  };
  return (
    <button
      type="button"
      onClick={back}
      aria-label="Back"
      className={cn("grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-sunken", onMedia && ON_MEDIA_ROUND)}
    >
      <ArrowLeft className="size-5" aria-hidden />
    </button>
  );
}
