import type { Metadata } from "next";
import { Landing } from "@/components/marketing/landing";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Static. Signed-in visitors are sent to /today by proxy.ts before this page is reached.
export default function Marketing() {
  return <Landing />;
}
