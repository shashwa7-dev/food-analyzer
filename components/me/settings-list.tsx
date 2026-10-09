"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Dumbbell, Globe, History, Leaf, Target, type LucideIcon } from "lucide-react";
import { FitnessSection, fitnessValue } from "@/components/me/fitness-section";
import type { FitnessSettings } from "@/lib/fitness/types";
import { targetsFor } from "@/lib/nutrition/targets";
import { ALLERGEN_KEYS, type AllergenKey } from "@/lib/nutrition/personalise";
import type { DailyTargets, Diet, Goal } from "@/lib/nutrition/types";
import { ALLERGEN_LABELS, DIET_LABEL, GOAL_LABEL } from "@/lib/profile/options";
import { SettingSheet } from "@/components/me/setting-sheet";
import { THEME_ICON, ThemeTiles } from "@/components/theme/theme-options";
import { useTheme } from "@/components/theme/theme-provider";
import { THEME_LABEL } from "@/lib/theme";
import { AllergiesSection, CountrySection, DietSection, GoalSection, countryName } from "@/components/me/settings-form";

export interface SettingsValues {
  goal: Goal;
  diet: Diet;
  allergies: string[];
  targets: Partial<DailyTargets> | null;
  country: string;
  /** Whether the plan may set custom daily targets (allows(plan, "customTargets")). */
  customTargets: boolean;
  fitness: FitnessSettings;
}

type Section = "goal" | "diet" | "allergies" | "fitness" | "country" | "appearance";

const META: Record<Section, { icon: LucideIcon; label: string; hint: string }> = {
  goal: { icon: Target, label: "Goal", hint: "Your goal sets your daily targets" },
  diet: { icon: Leaf, label: "Diet", hint: "Foods that don't fit get flagged" },
  allergies: { icon: AlertTriangle, label: "Allergies", hint: "Pick any that apply to you" },
  fitness: { icon: Dumbbell, label: "Fitness", hint: "Your weekly workout goal and goal weight" },
  country: { icon: Globe, label: "Country", hint: "Where you shop for food" },
  // The icon follows the choice (Moon, Sun or Monitor); see `iconOf` below.
  appearance: { icon: THEME_ICON.dark, label: "Appearance", hint: "Dark, light, or match your device" },
};

/**
 * The Me page's six settings in one card (mock-c1 `.xlist`): a plain muted icon, the label, the
 * current value (truncated) and a chevron. Each row opens its section of the settings form in a sheet;
 * Appearance's sheet is three tiles that apply on tap (no Save) and close it.
 */
export function SettingsList({ values, historyCount }: { values: SettingsValues; historyCount: number }) {
  const { theme, setTheme } = useTheme();
  const [section, setSection] = useState<Section>("goal");
  const [open, setOpen] = useState(false);
  // A fresh section (and its drafts) every time a sheet opens.
  const [session, setSession] = useState(0);

  const allergies = values.allergies.filter((a): a is AllergenKey => (ALLERGEN_KEYS as readonly string[]).includes(a));
  const kcal = targetsFor(values.goal, values.targets).energyKcal;
  const value: Record<Section, string> = {
    goal: `${GOAL_LABEL[values.goal]} · ${kcal.toLocaleString("en-IN")} kcal`,
    diet: DIET_LABEL[values.diet],
    allergies: allergies.length ? allergies.map((a) => ALLERGEN_LABELS[a]).join(", ") : "None",
    fitness: fitnessValue(values.fitness),
    country: countryName(values.country),
    appearance: THEME_LABEL[theme],
  };
  const iconOf = (s: Section): LucideIcon => (s === "appearance" ? THEME_ICON[theme] : META[s].icon);

  const show = (s: Section) => {
    setSection(s);
    setSession((n) => n + 1);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const meta = META[section];

  return (
    <>
      <div className="overflow-hidden rounded-[20px] bg-surface shadow-card">
        {(Object.keys(META) as Section[]).map((s) => {
          const { label } = META[s];
          const Icon = iconOf(s);
          return (
            <Fragment key={s}>
              {/* Scan history sits just above Appearance: a link, not a sheet, but the same row shape. */}
              {s === "appearance" && (
                <Link
                  href="/history"
                  className="flex min-h-[54px] w-full items-center gap-3.5 px-4 text-left text-ink transition-colors not-first:border-t not-first:border-line hover:bg-sunken/60"
                >
                  <History className="size-5 shrink-0 text-subtle" aria-hidden />
                  <span className="shrink-0 font-[550] whitespace-nowrap">Scan history</span>
                  <span className="ml-auto min-w-0 truncate text-right text-[14px] text-subtle">
                    <span className="num">{historyCount}</span>
                  </span>
                  <ChevronRight className="size-[18px] shrink-0 text-subtle" aria-hidden />
                </Link>
              )}
              <button
                type="button"
                onClick={() => show(s)}
                aria-haspopup="dialog"
                className="flex min-h-[54px] w-full items-center gap-3.5 px-4 text-left text-ink transition-colors not-first:border-t not-first:border-line hover:bg-sunken/60"
              >
                <Icon className="size-5 shrink-0 text-subtle" aria-hidden />
                <span className="shrink-0 font-[550] whitespace-nowrap">{label}</span>
                <span className="ml-auto min-w-0 truncate text-right text-[14px] text-subtle">
                  <span className="num">{value[s]}</span>
                </span>
                <ChevronRight className="size-[18px] shrink-0 text-subtle" aria-hidden />
              </button>
            </Fragment>
          );
        })}
      </div>

      <SettingSheet open={open} onOpenChange={setOpen} icon={iconOf(section)} title={meta.label} hint={meta.hint}>
        {section === "goal" && <GoalSection key={session} goal={values.goal} targets={values.targets} customTargets={values.customTargets} onDone={close} />}
        {section === "diet" && <DietSection key={session} diet={values.diet} onDone={close} />}
        {section === "allergies" && <AllergiesSection key={session} diet={values.diet} allergies={values.allergies} onDone={close} />}
        {section === "fitness" && <FitnessSection key={session} fitness={values.fitness} onDone={close} />}
        {section === "country" && <CountrySection key={session} country={values.country} onDone={close} />}
        {section === "appearance" && <ThemeTiles theme={theme} onPick={(t) => { setTheme(t); close(); }} />}
      </SettingSheet>
    </>
  );
}
