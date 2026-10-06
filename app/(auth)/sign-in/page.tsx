"use client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function SignIn() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="flex flex-col gap-2">
        <h1 className="title text-2xl">EATRi8</h1>
        <p className="text-subtle">Track what you eat. Scan any food. See how healthy it really is.</p>
      </div>
      <Button className="h-12" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/today" })}>
        Continue with Google
      </Button>
      <p className="text-sm text-subtle">By continuing you agree to the terms and privacy policy.</p>
    </main>
  );
}
