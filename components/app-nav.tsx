"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, History, LineChart, ScanLine, Search, Settings, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SidebarCredits } from "@/components/nav/sidebar-credits";
import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";

type NavIcon = typeof CalendarDays;
type NavItem = { href: string; label: string; icon: NavIcon; primary?: boolean; showCount?: boolean };

const PHONE_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/scan", label: "Scan", icon: ScanLine, primary: true },
  { href: "/history", label: "History", icon: History },
  { href: "/me", label: "Me", icon: User },
];

const DESKTOP_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/foods", label: "Foods", icon: Search },
  { href: "/history", label: "History", icon: History, showCount: true },
];

export function AppNav({
  credits,
  allowance,
  resetsLabel,
  planLabel,
  name,
  historyCount,
}: {
  credits: number;
  allowance: number;
  resetsLabel: string;
  planLabel: string;
  name: string;
  historyCount: number;
}) {
  const path = usePathname();
  // Onboarding is a focused flow: its nav links would only bounce back to it.
  if (path.startsWith("/onboarding")) return null;
  const active = (href: string) => path === href || path.startsWith(`${href}/`);
  // Food search, a food's page, the custom food form, the scanner, a scan result and the workout
  // screens are focused sub-pages with their own Back (mock-c1): no phone bottom nav there. The
  // weight log keeps it, like Me → Credits: it's a browsing page, not a flow that can lose input.
  const phoneNav = path !== "/foods" && !path.startsWith("/foods/") && !path.startsWith("/workouts/") && path !== "/scan" && !path.startsWith("/scans/");

  return (
    <>
      {/* Desktop sidebar (spec §5). Every row is a pill like Scan food: nav items, credits, profile. */}
      <nav
        aria-label="Main"
        className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-[252px] md:flex-col md:gap-3 md:border-r md:border-line md:bg-surface/55 md:px-3.5 md:py-5"
      >
        <Logo className="px-2.5 text-xl" />
        <div className="grid gap-0.5">
          {/* The first row, shaped exactly like the nav items below; only the fill (and an 8 px gap under it) sets it apart. */}
          <Link
            href="/scan"
            className="mb-2 flex min-h-11 items-center gap-3 whitespace-nowrap rounded-full bg-brand px-3.5 font-semibold text-brand-ink transition-colors hover:bg-brand/90"
          >
            <ScanLine className="size-5" aria-hidden />
            Scan food
            <kbd className="ml-auto rounded-md bg-brand-ink/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold">S</kbd>
          </Link>
          {DESKTOP_ITEMS.map(({ href, label, icon: Icon, showCount }) => {
            const isActive = active(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 whitespace-nowrap rounded-full px-3.5 font-medium text-subtle hover:bg-sunken hover:text-ink",
                  isActive && "bg-surface font-semibold text-ink shadow-card",
                )}
              >
                <Icon className={cn("size-5", isActive && "text-brand-deep")} aria-hidden />
                {label}
                {showCount && <span className="ml-auto rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold text-subtle num">{historyCount}</span>}
              </Link>
            );
          })}
        </div>
        <SidebarCredits credits={credits} allowance={allowance} resetsLabel={resetsLabel} />
        {/* Profile row: the link to Me (Appearance and other settings live there). */}
        <div className="flex items-center">
          <Link href="/me" className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full p-1.5 pr-2 hover:bg-sunken">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] font-bold text-on-brand-soft">{initialsOf(name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{name}</span>
              <span className="block truncate text-xs whitespace-nowrap text-subtle">{planLabel} plan</span>
            </span>
            <Settings className="size-5 shrink-0 text-subtle" aria-hidden />
          </Link>
        </div>
      </nav>

      {/* Phone bottom nav (spec §5) */}
      {phoneNav && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 mx-3 mb-[calc(12px+env(safe-area-inset-bottom))] grid h-[72px] grid-cols-5 rounded-[28px] bg-surface px-1.5 shadow-card md:hidden"
        >
          {PHONE_ITEMS.map(({ href, label, icon: Icon, primary }) => {
            const isActive = active(href);
            if (primary) {
              return (
                <Link key={href} href={href} aria-label="Scan" className="flex h-full items-center justify-center">
                  <span className="-mt-[30px] grid size-[60px] place-items-center rounded-full bg-brand text-brand-ink shadow-[0_8px_18px_-2px_color-mix(in_srgb,var(--brand)_55%,transparent)] ring-[6px] ring-bg">
                    <Icon className="size-[26px]" aria-hidden />
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn("flex h-full flex-col items-center justify-center gap-[3px] whitespace-nowrap text-[10.5px] font-semibold text-subtle", isActive && "text-ink")}
              >
                <Icon className="size-[22px]" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
