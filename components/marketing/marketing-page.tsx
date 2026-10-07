import type { ReactNode } from "react";
import Link from "next/link";
import { BackButton } from "@/components/nav/back-button";
import { Logo } from "@/components/brand/logo";

/**
 * A text page outside the app (privacy, terms, data sources): the wash, a top bar with Back and the
 * logo, a large title, then the body in one white card. Prose lines stop at about 65 characters.
 */
export function MarketingPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <main className="bg-wash min-h-dvh px-4 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(40px+env(safe-area-inset-bottom))] md:px-8 md:pt-8">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5">
        <div className="flex items-center justify-between gap-2.5">
          <BackButton fallback="/" />
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full px-2" aria-label="EATRi8 home">
            <Logo className="text-[19px]" />
          </Link>
          <span className="size-11 shrink-0" aria-hidden />
        </div>
        <header className="flex flex-col gap-2 px-1">
          <h1 className="title m-0 text-[34px] leading-[1.05] font-[650] tracking-[-0.04em] text-ink md:text-[40px]">{title}</h1>
          <p className="m-0 max-w-[65ch] text-[15px] leading-normal text-subtle">{intro}</p>
        </header>
        <div className="flex flex-col gap-6 rounded-[24px] bg-surface p-5 shadow-card md:p-7">{children}</div>
      </div>
    </main>
  );
}

/** One titled block of prose inside the MarketingPage card. */
export function ProseSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex max-w-[65ch] flex-col gap-2 text-[15px] leading-relaxed text-ink">
      <h2 className="section-title m-0">{title}</h2>
      {children}
    </section>
  );
}
