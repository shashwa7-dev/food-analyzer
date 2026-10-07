import Link from "next/link";

export const metadata = { title: "Privacy — EATRi8" };

// Deliberate exception to "all env vars go through lib/env.ts": lib/env.ts's env()
// requires Google OAuth vars to be present, which would make this static,
// unauthenticated page crash the build/render if those vars are ever unset in a
// given deployment. OFF_CONTACT_EMAIL is optional and only used for display text
// here, so we read it directly from process.env instead.
const contactEmail = process.env.OFF_CONTACT_EMAIL || "";

export default function PrivacyPage() {
  const contact = contactEmail || "the contact address on this page";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-subtle underline">
        Back
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="title text-2xl">Privacy</h1>
        <p className="text-sm text-subtle">Plain language, no legalese. Last updated October 2026.</p>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="section-title">What we store</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-subtle">
          <li>Basic profile info from your Google sign-in: name, email, profile photo.</li>
          <li>Your food diary: what you log, when, and the nutrition figures for it.</li>
          <li>Any custom foods you create.</li>
          <li>Your goal, diet, allergies and targets, so we can personalise grades and flags.</li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="section-title">What we don&apos;t do</h2>
        <p className="text-sm text-subtle">We don&apos;t sell your data, and we don&apos;t share it with advertisers.</p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="section-title">Not medical advice</h2>
        <p className="text-sm text-subtle">
          EATRi8 shows nutrition information and honest grades to help you make your own choices. It is not medical advice. Talk to a doctor or
          dietitian for anything related to a health condition.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="section-title">Deleting your account</h2>
        <p className="text-sm text-subtle">
          You can delete your account at any time from Me → Delete account. This removes your profile and diary. We keep only a
          one-way, keyed hash of your email with how many AI scans you used this month and today, so deleting and signing up again
          doesn&apos;t reset your allowance. It contains no readable email or other details. We keep that record until the end of
          the month it was made.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="section-title">Contact</h2>
        <p className="text-sm text-subtle">
          Questions about this policy? Reach us at {contact.includes("@") ? <a href={`mailto:${contact}`} className="underline">{contact}</a> : contact}.
        </p>
      </section>
    </main>
  );
}
