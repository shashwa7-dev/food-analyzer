import { MarketingPage, ProseSection } from "@/components/marketing/marketing-page";

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
    <MarketingPage title="Privacy" intro="Plain language, no legalese. Last updated October 2026.">
      <ProseSection title="What we store">
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 marker:text-brand-deep">
          <li>Basic profile info from your Google sign-in: name, email, profile photo.</li>
          <li>Your food diary: what you log, when, and the nutrition figures for it.</li>
          <li>Any custom foods you create.</li>
          <li>Workouts you log (sessions, exercises, sets, duration and estimated calories burned) and the body weights you log, including a goal weight.</li>
          <li>Photos from AI scans are kept for 30 days so you can see them in your history; a small thumbnail stays until you delete the scan.</li>
          <li>Your goal, diet, allergies and targets, so we can personalise grades and flags.</li>
        </ul>
      </ProseSection>
      <ProseSection title="What we don't do">
        <p className="m-0">We don&apos;t sell your data, and we don&apos;t share it with advertisers.</p>
      </ProseSection>
      <ProseSection title="Not medical advice">
        <p className="m-0">
          EATRi8 shows nutrition information and honest grades to help you make your own choices. It is not medical advice. Talk to a doctor or
          dietitian for anything related to a health condition.
        </p>
      </ProseSection>
      <ProseSection title="Deleting your account">
        <p className="m-0">
          You can delete your account at any time from Me → Delete account. This removes your profile, diary, scans, scan photos, workouts and weight log. We keep only a
          one-way, keyed hash of your email with how many AI scans you used this month and today, so deleting and signing up again
          doesn&apos;t reset your allowance. It contains no readable email or other details. It only counts toward the month it was
          made, and we delete it after that month ends.
        </p>
      </ProseSection>
      <ProseSection title="Contact">
        <p className="m-0">
          Questions about this policy? Reach us at{" "}
          {contact.includes("@") ? <a href={`mailto:${contact}`} className="font-medium text-brand-deep underline underline-offset-2">{contact}</a> : contact}.
        </p>
      </ProseSection>
    </MarketingPage>
  );
}
