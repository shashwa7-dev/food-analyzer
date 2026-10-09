import { BrandLoader } from "@/components/ui/skeleton";

// The fallback for signed-in pages without a skeleton of their own (one scan, the scanner, onboarding).
export default function AppLoading() {
  return <BrandLoader />;
}
