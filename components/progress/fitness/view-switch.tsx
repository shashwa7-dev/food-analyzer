import Link from "next/link";
import { cn } from "@/lib/utils";

export type ProgressView = "food" | "fitness";

/**
 * Food | Fitness (mock-c1 `.fo-switch`): two links, so the view lives in `?view=` and survives a reload.
 * Food keeps the range the user had picked.
 */
export function ViewSwitch({ view, range, className }: { view: ProgressView; range: "week" | "month"; className?: string }) {
  const items: { key: ProgressView; label: string; href: string }[] = [
    { key: "food", label: "Food", href: range === "month" ? "/progress?range=month" : "/progress" },
    { key: "fitness", label: "Fitness", href: "/progress?view=fitness" },
  ];
  return (
    <nav aria-label="Progress view" className={cn("grid grid-cols-2 gap-1 rounded-full bg-surface p-1 shadow-card", className)}>
      {items.map((i) => {
        const on = i.key === view;
        return (
          <Link
            key={i.key}
            href={i.href}
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-full text-[14px] font-semibold whitespace-nowrap transition-colors",
              on ? "bg-action text-action-ink" : "text-subtle hover:text-ink",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
