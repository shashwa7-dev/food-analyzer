"use client";
import { THEME_ICON } from "@/components/theme/theme-options";
import { useTheme } from "@/components/theme/theme-provider";
import { THEME_LABEL, nextTheme } from "@/lib/theme";

/**
 * The desktop sidebar's appearance control: a 36 px round icon in a 44 px hit area that cycles
 * Dark → Light → System. The icon and label show the current choice.
 */
export function ThemeCycleButton() {
  const { theme, setTheme } = useTheme();
  const Icon = THEME_ICON[theme];
  const label = `Theme: ${THEME_LABEL[theme]}`;
  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme(theme))}
      aria-label={label}
      title={`${label} (click for ${THEME_LABEL[nextTheme(theme)]})`}
      className="group/theme grid size-11 shrink-0 place-items-center rounded-full outline-none"
    >
      <span className="grid size-9 place-items-center rounded-full text-subtle transition-colors group-hover/theme:bg-sunken group-hover/theme:text-ink group-focus-visible/theme:ring-2 group-focus-visible/theme:ring-brand-deep">
        <Icon className="size-[18px]" aria-hidden />
      </span>
    </button>
  );
}
