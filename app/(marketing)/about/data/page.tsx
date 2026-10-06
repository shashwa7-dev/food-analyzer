import Link from "next/link";

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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-subtle underline">
        Back
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="title text-2xl">Where our data comes from</h1>
        <p className="text-sm text-subtle">
          EATRi8 grades and nutrition figures are built on these open datasets. We&apos;re grateful to the teams that maintain them.
        </p>
      </div>
      <ul className="flex flex-col gap-5">
        {SOURCES.map((s) => (
          <li key={s.name} className="flex flex-col gap-1">
            <a href={s.href} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
              {s.name}
            </a>
            <p className="text-sm text-subtle">{s.detail}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
