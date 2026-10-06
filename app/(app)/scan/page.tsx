import Link from "next/link";

export default function ScanPage() {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-card">
      <h1 className="section-title">Scan</h1>
      <p className="mt-2 text-subtle">Scanning arrives in the next update. Search or quick add works today.</p>
      <Link href="/foods" className="mt-4 inline-flex min-h-11 items-center font-semibold text-accent">
        Go to Foods
      </Link>
    </div>
  );
}
