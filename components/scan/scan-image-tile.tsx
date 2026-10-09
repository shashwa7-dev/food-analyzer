"use client";
// The tile beside a scan result's title: the scan's stored image, else the food-type icon.
// The image URL is signed for 10 minutes. If it fails to load, the route is refreshed once for a
// fresh URL; a second failure (or a refresh that brings the same URL) falls back to the icon.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FOOD_ICON } from "@/components/food/food-icon";
import type { FoodIconKey } from "@/lib/foods/icon";

const TILE = "size-[72px] shrink-0 rounded-[20px] md:size-24 md:rounded-[24px]";

export function ScanImageTile({ src, name, iconKey }: { src: string | null; name: string; iconKey: FoodIconKey }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [failed, setFailed] = useState<string[]>([]);
  const img = useRef<HTMLImageElement>(null);

  const fail = (url: string) => {
    if (failed.includes(url)) return;
    setFailed([...failed, url]);
    if (failed.length === 0) startTransition(() => router.refresh());
  };
  // A load that failed before hydration never fired React's onError: check once mounted.
  useEffect(() => {
    const el = img.current;
    if (src && el && el.complete && el.naturalWidth === 0) fail(src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (src && failed.length < 2 && !failed.includes(src)) {
    return (
      // A plain <img>: a signed R2 URL on another host.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={img}
        src={src}
        alt={`${name}, scan photo`}
        width={96}
        height={96}
        loading="eager"
        decoding="async"
        draggable={false}
        onError={() => fail(src)}
        data-scan-image
        className={`${TILE} bg-sunken object-cover`}
      />
    );
  }
  const Icon = FOOD_ICON[iconKey];
  return (
    <span data-scan-image className={`${TILE} grid place-items-center bg-brand-soft text-brand-deep`} aria-hidden>
      <Icon className="size-8 md:size-10" />
    </span>
  );
}
