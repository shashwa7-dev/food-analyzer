"use client";
// The scan result's photo hero (mock-c1 "Food details (stored photo)"): the stored display copies,
// full-bleed on a phone and a rounded card on desktop, swipeable (scroll snap), with Previous/Next
// arrows and ←/→ keys when there are several, the "N photos" chip, and the top bar laid over a soft
// scrim; the result's content follows on a sheet over the photo's bottom edge (phone). Shown only when
// the scan has photoUrls. The URLs are signed for 10 minutes: when a photo fails to load, the page is
// refreshed once for fresh URLs, and if one fails again the result falls back to the no-photo header.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { ON_MEDIA_ROUND } from "@/components/nav/back-button";
import { cn } from "@/lib/utils";

const ARROW = cn("absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full shadow-card [&_svg]:size-5", ON_MEDIA_ROUND);

export function PhotoHero({ urls, name, mediaBar, plainBar, children }: {
  urls: string[];
  /** The food's name, for each photo's alt text ("Masala Peanuts, photo 1"). */
  name: string;
  /** The top bar styled for the photo, and the plain one for the fallback. */
  mediaBar: ReactNode;
  plainBar: ReactNode;
  /** The result's content. */
  children: ReactNode;
}) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [refreshed, setRefreshed] = useState(false);
  const [broken, setBroken] = useState(false);
  const n = urls.length;

  const onImageError = () => {
    if (!refreshed) {
      setRefreshed(true);
      router.refresh(); // getScan signs fresh URLs; the new srcs remount the images
    } else {
      setBroken(true);
    }
  };
  // A photo that failed before hydration never fired the onError React attaches: check once mounted
  // (and again for the refreshed URLs).
  const onErrorRef = useRef(onImageError);
  useEffect(() => {
    onErrorRef.current = onImageError;
  });
  useEffect(() => {
    const failed = [...(scroller.current?.querySelectorAll("img") ?? [])].some((img) => img.complete && img.naturalWidth === 0);
    if (failed) onErrorRef.current();
  }, [urls]);

  if (broken) {
    return (
      <>
        {plainBar}
        {children}
      </>
    );
  }

  const go = (to: number) => {
    const el = scroller.current;
    if (!el) return;
    const i = Math.max(0, Math.min(n - 1, to));
    el.scrollTo({ left: i * el.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    return i;
  };
  // An arrow that is about to disappear (the first or last photo reached) hands focus to the carousel,
  // which keeps the ←/→ keys, so keyboard focus never drops to the page.
  const step = (delta: -1 | 1) => {
    const i = go(index + delta);
    if (i === 0 || i === n - 1) scroller.current?.focus({ preventScroll: true });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      go(index + (e.key === "ArrowLeft" ? -1 : 1));
    }
  };

  return (
    <>
      <section
        aria-roledescription="carousel"
        aria-label={`${name}: scan photos`}
        className="relative -mx-4 -mt-4 h-[46dvh] max-h-[440px] min-h-[260px] overflow-hidden bg-viewfinder md:mx-0 md:mt-0 md:h-[380px] md:rounded-[28px]"
      >
        <div
          ref={scroller}
          tabIndex={n > 1 ? 0 : undefined}
          role="group"
          aria-label={n > 1 ? "Photos (the left and right arrow keys move between them)" : "Photo"}
          onKeyDown={onKeyDown}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
          className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-on-media focus-visible:ring-inset md:rounded-[28px] [&::-webkit-scrollbar]:hidden"
        >
          {urls.map((src, i) => (
            <div key={src} role="group" aria-roledescription="slide" aria-label={`Photo ${i + 1} of ${n}`} className="h-full w-full shrink-0 snap-center">
              {/* Signed R2 URLs on another host, 10 minutes each: a plain <img>, not next/image's optimiser. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${name}, photo ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
                onError={onImageError}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-linear-to-b from-viewfinder/55 via-transparent via-40% to-transparent" />
        <div className="absolute inset-x-0 top-0 px-4 pt-4 md:px-5">{mediaBar}</div>
        {index > 0 && (
          <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className={cn(ARROW, "left-3")}>
            <ChevronLeft aria-hidden />
          </button>
        )}
        {index < n - 1 && (
          <button type="button" aria-label="Next photo" onClick={() => step(1)} className={cn(ARROW, "right-3")}>
            <ChevronRight aria-hidden />
          </button>
        )}
        <p className="absolute right-4 bottom-11 m-0 inline-flex items-center gap-1.5 rounded-full bg-viewfinder/70 px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-on-media md:bottom-4">
          <Camera className="size-[15px]" aria-hidden />
          <span className="num">{n === 1 ? "1 photo" : `${n} photos`}</span>
        </p>
      </section>
      {/* The sheet over the photo's bottom edge (mock-c1 `.sheet-body`), on a phone only. */}
      <div className="relative -mx-4 -mt-10 flex flex-col gap-3 rounded-t-[32px] bg-bg px-4 pt-2.5 md:mx-0 md:mt-1 md:rounded-none md:bg-transparent md:p-0">
        <span aria-hidden="true" className="mx-auto mb-1 block h-[5px] w-10 shrink-0 rounded-full bg-line md:hidden" />
        {children}
      </div>
    </>
  );
}
