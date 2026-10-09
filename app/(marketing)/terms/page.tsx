import { MarketingPage, ProseSection } from "@/components/marketing/marketing-page";

export const metadata = { title: "Terms" };

// Deliberate exception to "all env vars go through lib/env.ts": see app/(marketing)/privacy/page.tsx
// for why this static page reads OFF_CONTACT_EMAIL directly instead of via env().
const contactEmail = process.env.OFF_CONTACT_EMAIL || "";

export default function TermsPage() {
  const contact = contactEmail || "the contact address on this page";
  return (
    <MarketingPage title="Terms" intro="Plain language, no legalese. Last updated October 2026.">
      <ProseSection title="The service">
        <p className="m-0">
          Santul helps you log food and see honest, neutral grades for it. You sign in with Google; there&apos;s no separate password to manage.
        </p>
      </ProseSection>
      <ProseSection title="Not medical advice">
        <p className="m-0">
          Nothing in Santul is medical, dietary or clinical advice. Grades and flags are informational. Use your own judgement, and check with a
          doctor or dietitian for anything related to a health condition.
        </p>
      </ProseSection>
      <ProseSection title="Your content">
        <p className="m-0">
          Entries and custom foods you add remain yours. You can delete your account at any time from Me → Delete account, which removes your
          profile and diary.
        </p>
      </ProseSection>
      <ProseSection title="No warranty">
        <p className="m-0">
          Santul is provided as-is. Nutrition figures come from public databases and user submissions and may contain errors — check the pack
          when it matters.
        </p>
      </ProseSection>
      <ProseSection title="Contact">
        <p className="m-0">
          Questions about these terms? Reach us at{" "}
          {contact.includes("@") ? <a href={`mailto:${contact}`} className="font-medium text-brand-deep underline underline-offset-2">{contact}</a> : contact}.
        </p>
      </ProseSection>
    </MarketingPage>
  );
}
