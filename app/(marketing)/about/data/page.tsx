import { ArrowUpRight, Database } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import { MarketingPage } from "@/components/marketing/marketing-page";

export const metadata = { title: "Data sources — EATRi8" };

const SOURCES = [
  {
    name: "Indian Nutrient Databank (INDB)",
    detail: "Vasudevan, Jaacks et al., 2024. Licensed CC BY 4.0.",
    href: "https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-",
  },
  {
    name: "USDA FoodData Central (FNDDS 2021–2023)",
    detail: "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019. Licensed CC0 1.0.",
    href: "https://fdc.nal.usda.gov",
  },
  {
    name: "Open Food Facts",
    detail: "Licensed under the Open Database License (ODbL); product images are licensed CC BY-SA.",
    href: "https://openfoodfacts.org",
  },
];

export default function DataSourcesPage() {
  return (
    <MarketingPage
      title="Where our data comes from"
      intro={<>EATRi8 grades and nutrition figures are built on these open datasets. We&apos;re grateful to the teams that maintain them.</>}
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {SOURCES.map((s) => {
          // The arrow stays on the line of the name's last word, so a wrapped name never strands it.
          const words = s.name.split(" ");
          const last = words.pop();
          return (
            <li key={s.name} className="flex items-start gap-3 border-line py-3 first:pt-0 last:pb-0 not-first:border-t">
              <IconTile tone="brand"><Database /></IconTile>
              <div className="flex min-w-0 max-w-[65ch] flex-col">
                <a href={s.href} target="_blank" rel="noreferrer" className="block py-2.5 leading-6 font-semibold text-ink underline underline-offset-2">
                  {words.length > 0 && `${words.join(" ")} `}
                  <span className="whitespace-nowrap">
                    {last}
                    <ArrowUpRight className="ml-1 inline size-4 align-[-2px] text-brand-deep" aria-hidden />
                  </span>
                </a>
                <p className="m-0 text-[14px] leading-normal text-subtle">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </MarketingPage>
  );
}
