"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { backAction, readInAppNav } from "@/lib/nav/back";

/** A sub-page's round Back (mock-c1 `.round`): browser back after an in-app navigation, else `fallback`. */
export function BackButton({ fallback }: { fallback: string }) {
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
      className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-sunken"
    >
      <ArrowLeft className="size-5" aria-hidden />
    </button>
  );
}
