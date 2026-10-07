"use client";
// A scan's stored thumbnail in a list row (History, Today's Recent scans), in place of its icon tile.
// The URL is signed for 10 minutes: once it lapses on a long-open page, the row falls back to `fallback`.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const SIZE = { sm: "size-10 rounded-[12px]", md: "size-11 rounded-[14px]" } as const;

export function ScanThumb({ src, size, fallback }: { src: string; size: keyof typeof SIZE; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // A load that failed before hydration never fired React's onError: check once mounted.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);
  if (failed) return <>{fallback}</>;
  return (
    // Decorative (the row's title names the food); a plain <img>: signed R2 URLs on another host.
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} className={cn("shrink-0 bg-sunken object-cover", SIZE[size])} />
  );
}
