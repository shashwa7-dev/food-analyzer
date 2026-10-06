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

export function AppNav() {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(`${href}/`);
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
