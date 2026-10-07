"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function TimezoneSync({ current }: { current: string }) {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) {
      void fetch("/api/v1/me/timezone", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ timezone: tz }) })
        .then((r) => { if (r.ok) router.refresh(); });
    }
  }, [current, router]);
  return null;
}
