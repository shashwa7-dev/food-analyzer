import type { Metadata } from "next";
import { Landing } from "@/components/marketing/landing";

// The same page as the home page (where signed-out visitors to an app route land), so search
// engines are pointed at / instead.
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true }, alternates: { canonical: "/" } };

export default function SignIn() {
  return <Landing />;
}
