import type { ReactNode } from "react";
import Link from "next/link";
import { Dumbbell, ScanLine, Soup } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconTile } from "@/components/ui/icon-tile";
import { GradeBadge } from "@/components/grade-badge";
import { Logo } from "@/components/brand/logo";
import { GoogleSignInButton } from "@/components/brand/google-sign-in-button";

type Feature = { icon: ReactNode; title: string; text: string; shortText: string };

const FEATURES: Feature[] = [
  {
    icon: <IconTile tone="brand" size="md"><Soup /></IconTile>,
    title: "Log meals in real portions",
    text: "14,800 foods, with Indian dishes by the katori, roti or glass.",
    shortText: "Indian dishes by the katori, roti or glass.",
  },
  {
    icon: <IconTile tone="brand" size="md"><ScanLine /></IconTile>,
    title: "Scan any pack",
    text: "Barcodes are free. Photograph a label and it's read for you.",
    shortText: "Barcode or label, read for you.",
  },
  {
    icon: <span aria-hidden className="contents"><GradeBadge grade="A" size="md" /></span>,
    title: "Get an honest A–E grade",
    text: "Graded for your diet and goals, with the reasons spelled out.",
    shortText: "For your diet and goals, with reasons.",
  },
  {
    icon: <IconTile tone="brand" size="md"><Dumbbell /></IconTile>,
    title: "Track workouts and weight",
    text: "Log a session or a walk and your day's balance updates.",
    shortText: "See eaten against burned.",
  },
];

const LINKS = [
  { href: "/about/data", label: "Data sources" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

type Shot = "today" | "scan" | "workouts";

/**
 * One phone frame holding a screenshot from public/landing (written by pnpm brand:assets). Both
 * themes' images are in the markup and CSS shows the active one; they load lazily, so the hidden
 * theme's file is never fetched.
 */
function Phone({ shot, className }: { shot: Shot; className?: string }) {
  return (
    <div className={cn("absolute overflow-hidden border-line bg-bg shadow-[0_30px_70px_rgb(0_0_0/.16)] dark:shadow-[0_30px_70px_rgb(0_0_0/.55)]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative shots; nothing for the image optimiser to do */}
      <img src={`/landing/${shot}-light.webp`} alt="" width={584} height={1213} loading="lazy" decoding="async" className="block h-auto w-full dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
      <img src={`/landing/${shot}-dark.webp`} alt="" width={584} height={1213} loading="lazy" decoding="async" className="hidden h-auto w-full dark:block" />
    </div>
  );
}

/**
 * Today in front, a scan result and Workouts fanned out behind it. Decorative. "band" is the phone
 * layout (a short strip that clips the phones' lower halves); "column" is the desktop one, where the
 * side phones drop out on a narrow window so nothing reaches the text.
 */
function PhoneFan({ layout, className }: { layout: "band" | "column"; className?: string }) {
  const band = layout === "band";
  const side = band
    ? "top-[34px] h-[290px] w-[138px] rounded-[30px] border-[6px]"
    : "top-[68px] h-[480px] w-[232px] rounded-[42px] border-8 max-[1269px]:hidden";
  return (
    <div aria-hidden="true" className={cn("relative", band ? "h-[268px] overflow-hidden" : "h-[620px]", className)}>
      <Phone shot="scan" className={cn(side, "-rotate-[7deg]", band ? "left-[calc(50%-159px)]" : "left-[calc(50%-264px)]")} />
      <Phone shot="workouts" className={cn(side, "rotate-[7deg]", band ? "left-[calc(50%+21px)]" : "left-[calc(50%+32px)]")} />
      <Phone
        shot="today"
        className={band ? "top-2 left-[calc(50%-82px)] h-[340px] w-[164px] rounded-[30px] border-[6px]" : "top-0 left-[calc(50%-146px)] h-[604px] w-[292px] rounded-[42px] border-8"}
      />
    </div>
  );
}

function SiteLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="About Santul" className={cn("flex items-center", className)}>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center px-3 text-[14px] font-medium text-subtle hover:text-ink">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The signed-out home page, also shown at /sign-in. From 900 px it is one screen: the pitch and
 * Google sign-in on the left, three phones on the right. On a phone it is one scrolling column with
 * the sign-in bar pinned to the bottom, in thumb reach; the page's bottom padding clears the bar.
 */
export function Landing() {
  return (
    <main className="bg-wash flex min-h-dvh flex-col overflow-x-clip px-5 pt-[env(safe-area-inset-top)] pb-[calc(140px+env(safe-area-inset-bottom))] md:h-dvh md:min-h-[720px] md:px-16 md:pb-0">
      <header className="flex items-center justify-between pt-5 md:pt-6">
        <Logo className="text-[22px] md:text-[27px]" />
        <SiteLinks className="-mr-3 hidden md:flex" />
      </header>

      <div className="flex flex-1 flex-col pt-4 md:grid md:grid-cols-[minmax(0,570px)_minmax(292px,1fr)] md:items-center md:gap-x-8 md:pt-0">
        <div className="flex flex-col gap-[18px] md:items-start md:gap-[26px]">
          <h1 className="m-0 text-[43px] leading-none font-[650] tracking-[-0.048em] text-ink md:text-[58px] min-[1270px]:text-[66px]">
            Eat well.<br />
            Train well.<br />
            <span className="whitespace-nowrap text-brand-deep">Stay in balance.</span>
          </h1>
          <p className="m-0 text-base leading-[1.45] text-subtle md:hidden">Your meals, workouts and weight in one place.</p>
          <p className="m-0 hidden max-w-[27em] text-[19px] leading-[1.45] text-pretty text-subtle md:block">
            Santul keeps your meals, workouts and weight in one place, so you can see what you&apos;ve eaten against what you&apos;ve burned.
          </p>

          <PhoneFan layout="band" className="-mx-5 md:hidden" />

          <ul className="relative m-0 -mt-6 flex list-none flex-col rounded-[24px] bg-surface px-4 py-0.5 shadow-card md:mt-1.5 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-[22px] md:rounded-none md:bg-transparent md:p-0 md:shadow-none">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-center gap-3 border-line py-3 not-first:border-t md:items-start md:gap-3.5 md:py-0 md:not-first:border-t-0">
                {f.icon}
                <div className="min-w-0">
                  <span className="block text-[15px] leading-[1.3] font-semibold tracking-[-0.015em] text-ink md:text-base">{f.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-[1.4] text-subtle md:hidden">{f.shortText}</span>
                  <span className="mt-0.5 hidden text-sm leading-[1.4] text-pretty text-subtle md:block">{f.text}</span>
                </div>
              </li>
            ))}
          </ul>

          <SiteLinks className="-mt-2 justify-center md:hidden" />

          <div
            data-signin-bar
            className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2.5 bg-linear-to-b from-transparent to-bg to-[34%] px-5 pt-11 pb-[calc(20px+env(safe-area-inset-bottom))] md:static md:z-auto md:mt-2 md:items-start md:gap-3.5 md:bg-none md:p-0"
          >
            <div className="md:w-[280px]"><GoogleSignInButton /></div>
            <p className="m-0 text-center text-[13px] leading-snug text-pretty text-subtle md:text-left">
              Free to use. By continuing you agree to the{" "}
              <Link href="/terms" className="font-medium text-ink underline underline-offset-2">terms</Link> and{" "}
              <Link href="/privacy" className="font-medium text-ink underline underline-offset-2">privacy policy</Link>.
            </p>
          </div>
        </div>

        <PhoneFan layout="column" className="hidden w-[292px] justify-self-end md:block min-[1270px]:-mr-4 min-[1270px]:w-[540px]" />
      </div>
    </main>
  );
}
