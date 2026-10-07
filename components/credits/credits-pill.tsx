import Link from "next/link";
import { cn } from "@/lib/utils";

export function CreditsPill({ credits, className }: { credits: number; className?: string }) {
  return (
    <Link href="/me/credits" className={cn("flex min-h-11 items-center rounded-full bg-accent-soft px-3 text-sm font-semibold text-ink", className)}>
      {credits} scan{credits === 1 ? "" : "s"} left
    </Link>
  );
}
