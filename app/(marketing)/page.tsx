import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Marketing() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/today");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-3">
        <div className="title text-2xl">EATRi8</div>
        <p className="text-lg text-subtle">Track what you eat. Scan any food. See how healthy it really is.</p>
      </div>
      <ul className="flex flex-col gap-2 text-sm text-subtle">
        <li>Search Indian dishes like a katori of dal</li>
        <li>Scan a barcode or label</li>
        <li>See an honest A–E grade</li>
      </ul>
      <Link href="/sign-in" className="flex min-h-12 items-center justify-center rounded-md bg-accent font-semibold text-accent-ink">
        Continue with Google
      </Link>
      <Link href="/about/data" className="text-center text-sm text-subtle underline">
        Where our data comes from
      </Link>
    </main>
  );
}
