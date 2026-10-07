import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { GoogleSignInButton } from "@/components/brand/google-sign-in-button";

/**
 * Sign-in (C1): the wash, the logo lockup, one line, and Google as the one action. On a phone the
 * button sits low, in thumb reach; from 900 px everything is one centred column.
 */
export default function SignIn() {
  return (
    <main className="bg-wash flex min-h-dvh flex-col px-5 pt-[env(safe-area-inset-top)] pb-[calc(28px+env(safe-area-inset-bottom))] md:justify-center">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col md:flex-none">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center md:flex-none md:pb-10">
          <Logo className="text-[40px]" />
          <p className="m-0 text-[17px] leading-snug text-subtle text-balance">Track Indian meals and scan any pack.</p>
        </div>
        <div className="flex flex-col gap-3">
          <GoogleSignInButton />
          <p className="m-0 text-center text-[13px] leading-snug text-subtle text-pretty">
            By continuing you agree to the{" "}
            <Link href="/terms" className="font-medium text-ink underline underline-offset-2">terms</Link> and{" "}
            <Link href="/privacy" className="font-medium text-ink underline underline-offset-2">privacy policy</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
