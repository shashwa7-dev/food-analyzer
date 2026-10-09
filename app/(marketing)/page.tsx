import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Landing } from "@/components/marketing/landing";

export default async function Marketing() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/today");
  return <Landing />;
}
