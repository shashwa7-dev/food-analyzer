import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, ScanLine, Soup } from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { GradeBadge } from "@/components/grade-badge";
import { Logo } from "@/components/brand/logo";
import { GoogleGlyph } from "@/components/brand/google-glyph";

const FEATURES = [
  { icon: <IconTile tone="brand" size="md"><Soup /></IconTile>, text: "Search Indian dishes like a katori of dal" },
  { icon: <IconTile tone="brand" size="md"><ScanLine /></IconTile>, text: "Scan a barcode or label" },
  { icon: <span aria-hidden className="contents"><GradeBadge grade="A" size="md" /></span>, text: "See an honest A–E grade" },
];

export default async function Marketing() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/today");
  return (
    <main className="bg-wash flex min-h-dvh flex-col px-5 pt-[env(safe-area-inset-top)] pb-[calc(24px+env(safe-area-inset-bottom))] md:justify-center">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 md:flex-none">
        <div className="flex flex-1 flex-col justify-center gap-6 md:flex-none">
          <div className="flex flex-col items-center gap-3 text-center">
            <Logo className="text-[40px]" />
            <p className="m-0 text-[17px] leading-snug text-subtle text-balance">Track what you eat. Scan any food. See how healthy it really is.</p>
          </div>
          <ul className="m-0 flex list-none flex-col rounded-[24px] bg-surface px-4 py-1.5 shadow-card">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex min-h-[64px] items-center gap-3 border-line py-2.5 text-[15px] font-medium text-ink not-first:border-t">
                {f.icon}
                {f.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Button render={<Link href="/sign-in" />} nativeButton={false} shape="pill" size="xl" className="h-14 w-full">
            <GoogleGlyph />
            Continue with Google
          </Button>
          <Link href="/about/data" className="inline-flex min-h-11 items-center gap-1 px-2 text-[13px] font-medium text-subtle underline underline-offset-2">
            Where our data comes from
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </main>
  );
}
