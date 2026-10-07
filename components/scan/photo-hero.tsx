"use client";
// The scan result's photo hero (mock-c1 "Food details (stored photo)"): the stored display copies,
// full-bleed on a phone and a rounded card on desktop, swipeable (scroll snap) with Previous/Next
// arrows when there are several, the "N photos" chip, and the top bar laid over a soft scrim. Shown
// only when the scan has photoUrls; the URLs are signed for 10 minutes.
import { useRef, useState, type ReactNode } from "react";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { ON_MEDIA_ROUND } from "@/components/nav/back-button";
import { cn } from "@/lib/utils";

const ARROW = cn("absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full shadow-card [&_svg]:size-5", ON_MEDIA_ROUND);

export function PhotoHero({ urls, children }: { urls: string[]; /** The top bar, laid over the photo. */ children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const n = urls.length;
  const go = (to: number) => {
    const el = scroller.current;
    if (!el) return;
    const i = Math.max(0, Math.min(n - 1, to));
    el.scrollTo({ left: i * el.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Scan photos"
      className="relative -mx-4 -mt-4 h-[46dvh] max-h-[440px] min-h-[260px] overflow-hidden bg-viewfinder md:mx-0 md:mt-0 md:h-[380px] md:rounded-[28px]"
    >
      <div
        ref={scroller}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((src, i) => (
          // Signed R2 URLs on another host, 10 minutes each: a plain <img>, not next/image's optimiser.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={n > 1 ? `Scan photo ${i + 1} of ${n}` : "Scan photo"}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-linear-to-b from-viewfinder/55 via-transparent via-40% to-transparent" />
      <div className="absolute inset-x-0 top-0 px-4 pt-4 md:px-5">{children}</div>
      {index > 0 && (
        <button type="button" aria-label="Previous photo" onClick={() => go(index - 1)} className={cn(ARROW, "left-3")}>
          <ChevronLeft aria-hidden />
        </button>
      )}
      {index < n - 1 && (
        <button type="button" aria-label="Next photo" onClick={() => go(index + 1)} className={cn(ARROW, "right-3")}>
          <ChevronRight aria-hidden />
        </button>
      )}
      <p className="absolute right-4 bottom-11 m-0 inline-flex items-center gap-1.5 rounded-full bg-viewfinder/70 px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-on-media md:bottom-4">
        <Camera className="size-[15px]" aria-hidden />
        <span className="num">{n === 1 ? "1 photo" : `${n} photos`}</span>
      </p>
    </section>
  );
}
