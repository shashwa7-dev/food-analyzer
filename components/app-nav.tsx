"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, History, Search, ScanLine, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/foods", label: "Foods", icon: Search },
  { href: "/scan", label: "Scan", icon: ScanLine, primary: true },
  { href: "/history", label: "History", icon: History },
  { href: "/me", label: "Me", icon: User },
];

export function AppNav({ credits, allowance, planLabel }: { credits: number; allowance: number; planLabel: string }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(`${href}/`);
  const pct = allowance > 0 ? Math.min(credits / allowance, 1) * 100 : 0;
  return (
    <>
      <nav aria-label="Main" className="hidden md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-1 md:border-r md:border-line md:px-3.5 md:py-5">
        <div className="px-2.5 pb-4 text-[22px] font-bold tracking-[-0.04em]">EATRi<span className="text-accent">8</span></div>
        {ITEMS.filter((i) => !i.primary).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 font-medium text-subtle", active(href) && "bg-accent-soft font-semibold text-ink")}>
            <Icon className="size-5" aria-hidden />{label}
          </Link>
        ))}
        <Link href="/scan" className="mt-2.5 flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent font-semibold text-accent-ink">
          <ScanLine className="size-5" aria-hidden />Scan food
        </Link>
        <Link href="/me/credits" className="mt-auto flex flex-col gap-1.5 rounded-md border border-line bg-surface p-3">
          <span className="text-xs text-subtle">AI scans left</span>
          <span className="flex items-center justify-between">
            <span className="num text-lg font-semibold">{credits} / {allowance}</span>
            <span className="text-sm text-subtle">{planLabel}</span>
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-sunken">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </span>
          <span className="text-xs text-subtle">Barcode scans are free.</span>
        </Link>
      </nav>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t border-line bg-surface px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-1.5 md:hidden">
        {ITEMS.map(({ href, label, icon: Icon, primary }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}
            className={cn("flex min-h-12 flex-col items-center gap-0.5 text-[11px] font-semibold text-subtle", active(href) && "text-ink")}>
            {primary ? <span className="-mt-6 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-lg"><Icon className="size-6" aria-hidden /></span> : <Icon className="size-[22px]" aria-hidden />}
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
