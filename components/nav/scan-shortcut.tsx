"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EDITABLE = "input, textarea, select, [contenteditable], [contenteditable='true']";

/** Mounted once in the app layout: pressing S opens /scan, unless focus is in a field, a modifier is held, or a dialog/sheet is open. */
export function ScanShortcut() {
  const router = useRouter();
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "s" && e.key !== "S") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      if (target instanceof Element && target.closest(EDITABLE)) return;
      // An open dialog or sheet owns the keyboard; leaving it would drop the user's work.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      router.push("/scan");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
  return null;
}
