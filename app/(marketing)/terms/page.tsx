import Link from "next/link";

export const metadata = { title: "Terms — EATRi8" };

// Deliberate exception to "all env vars go through lib/env.ts": see app/(marketing)/privacy/page.tsx
// for why this static page reads OFF_CONTACT_EMAIL directly instead of via env().
const contactEmail = process.env.OFF_CONTACT_EMAIL || "";

export default function TermsPage() {
  const contact = contactEmail || "the contact address on this page";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-subtle underline">
        Back
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="title text-2xl">Terms</h1>
        <p className="text-sm text-subtle">Plain language, no legalese. Last updated October 2026.</p>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="section-title">The service</h2>
        <p className="text-sm text-subtle">
          EATRi8 helps you log food and see honest, neutral grades for it. You sign in with Google; there&apos;s no separate password to manage.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="section-title">Not medical advice</h2>
        <p className="text-sm text-subtle">
          Nothing in EATRi8 is medical, dietary or clinical advice. Grades and flags are informational. Use your own judgement, and check with a
          doctor or dietitian for anything related to a health condition.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="section-title">Your content</h2>
        <p className="text-sm text-subtle">
          Entries and custom foods you add remain yours. You can delete your account at any time from Me → Delete account, which removes your
          profile and diary.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="section-title">No warranty</h2>
        <p className="text-sm text-subtle">
          EATRi8 is provided as-is. Nutrition figures come from public databases and user submissions and may contain errors — check the pack
          when it matters.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="section-title">Contact</h2>
        <p className="text-sm text-subtle">
          Questions about these terms? Reach us at {contact.includes("@") ? <a href={`mailto:${contact}`} className="underline">{contact}</a> : contact}.
        </p>
      </section>
    </main>
  );
}
