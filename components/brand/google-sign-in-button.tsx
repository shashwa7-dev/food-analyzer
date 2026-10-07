"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { GoogleGlyph } from "@/components/brand/google-glyph";

/** "Continue with Google" (sign-in and the home page): starts Google sign-in straight away, landing on Today. */
export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const res = await authClient.signIn.social({ provider: "google", callbackURL: "/today" }).catch(() => null);
    // On success the browser is already leaving for Google; only a failure lands here with the page still up.
    if (!res || res.error) {
      toast.error("Couldn't reach Google. Try again.");
      setPending(false);
    }
  }

  return (
    <Button type="button" shape="pill" size="xl" className="h-14 w-full" disabled={pending} onClick={() => void signIn()}>
      {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <GoogleGlyph />}
      {pending ? "Opening Google…" : "Continue with Google"}
    </Button>
  );
}
