"use client";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { THEMES, THEME_LABEL, type Theme } from "@/lib/theme";

export const THEME_ICON: Record<Theme, LucideIcon> = { dark: Moon, light: Sun, system: Monitor };

/**
 * Three appearance tiles, icon over label (the meal tiles' look): the chosen one is brand-soft with a
 * lime border. Picking one calls onPick straight away; there is no Save.
 */
export function ThemeTiles({ theme, onPick }: { theme: Theme; onPick: (theme: Theme) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Appearance">
      {THEMES.map((t) => {
        const Icon = THEME_ICON[t];
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={t === theme}
            onClick={() => onPick(t)}
            className="flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[14px] border border-line bg-surface text-[13px] font-semibold whitespace-nowrap text-subtle transition-colors hover:text-ink aria-checked:border-brand aria-checked:bg-brand-soft aria-checked:text-brand-deep"
          >
            <Icon className="size-[22px]" aria-hidden />
            {THEME_LABEL[t]}
          </button>
        );
      })}
    </div>
  );
}
