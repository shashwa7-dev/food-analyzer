import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { foodDetail } from "@/lib/foods/service";
import { todayIn } from "@/lib/dates";
import { GradeStrip, GradeBadge } from "@/components/grade-badge";
import { AddToMeal } from "@/components/food/add-to-meal";
import { FoodOwnerActions } from "@/components/food/food-owner-actions";
import { FlagList, ReasonList } from "@/components/food/food-verdict";
import { nutrientsFor } from "@/lib/nutrition/portions";
import Link from "next/link";

const PROVENANCE_LABEL = { reference: "Reference data", community: "Community data", label: "Read from label", estimate: "Estimated" } as const;

export default async function FoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, profile } = await requireUser();
  const detail = await foodDetail(userId, (await params).id);
  if (!detail) notFound();
  const { food, reasons, flags, alternatives } = detail;
  const p = food.portions[food.defaultPortion] ?? food.portions[0]!;
  const n = p.grams ? nutrientsFor(food.per100, p.grams) : food.per100;
  const prov = Object.values(food.provenance)[0] ?? "reference";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: profile.timezone }).format(new Date()));
  const defaultMeal = hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 19 ? "snack" : "dinner";
  return (
    <div className="flex flex-col gap-4">
      <header>
        <div className="text-sm text-subtle capitalize">{food.kind === "ingredient" ? "Ingredient" : food.kind}</div>
        <h1 className="title text-[30px] md:text-[34px]">{food.name}</h1>{food.brand && <div className="text-sm text-subtle">{food.brand}</div>}
        {food.source === "custom" && <div className="mt-3"><FoodOwnerActions id={food.id} name={food.name} /></div>}
      </header>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3.5"><GradeStrip grade={food.grade} />
              {food.gradeValue !== null && <div className="text-right"><div className="num text-[26px] font-bold">{food.gradeValue}<span className="text-sm text-subtle">/100</span></div><div className="text-sm text-subtle">Health score</div></div>}</div>
            <ReasonList reasons={reasons} />
          </section>
          <FlagList flags={flags} />
          <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
            <AddToMeal food={food} date={todayIn(profile.timezone)} defaultMeal={defaultMeal} />
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between"><h2 className="section-title">Nutrition</h2><span className="text-xs font-semibold text-subtle">{PROVENANCE_LABEL[prov]}</span></div>
            <div className="mb-1.5 mt-1 text-sm text-subtle">For {p.label}{p.grams && <> (<span className="num">{p.grams} {food.basis === "per_100ml" ? "ml" : "g"}</span>)</>}</div>
            <table className="w-full text-sm"><tbody>
              {[["Calories", n.energyKcal, "kcal"], ["Protein", n.protein, "g"], ["Carbs", n.carbs, "g"], ["Sugars", n.sugars, "g"], ["Fat", n.fat, "g"], ["Saturated fat", n.satFat, "g"], ["Fibre", n.fibre, "g"], ["Sodium", n.sodiumMg, "mg"]]
                .filter(([, v]) => v !== undefined).map(([l, v, u]) => (
                <tr key={l as string} className="border-b border-line"><td className="py-2.5">{l}</td><td className="num py-2.5 text-right">{u === "mg" || u === "kcal" ? Math.round(v as number) : Math.round((v as number) * 10) / 10} {u}</td></tr>))}
            </tbody></table>
            {food.ingredients.length > 0 && <p className="mt-2.5 text-sm text-subtle">Ingredients: {food.ingredients.join(", ")}</p>}
          </section>
          {alternatives.length > 0 && <section className="rounded-lg border border-line bg-surface p-5 shadow-card"><h2 className="section-title mb-2.5">Healthier options</h2>
            {alternatives.slice(0, 1).map((a) => <Link key={a.id} href={`/foods/${a.id}`} className="flex items-center gap-3 rounded-md border border-line p-3"><GradeBadge grade={a.grade} /><span className="font-semibold">{a.name}</span></Link>)}</section>}
        </div>
      </div>
      <p className="text-sm text-subtle">Information only, not medical advice. Check the pack for allergens.</p>
    </div>
  );
}
