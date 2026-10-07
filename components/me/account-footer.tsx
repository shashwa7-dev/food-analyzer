"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { authClient } from "@/lib/auth-client";
import { deleteAccountAction } from "@/app/(app)/me/actions";

// Data export (CSV) isn't built yet. When it is, its link goes in this list, shown only when
// allows(plan, "dataExport") (lib/credits/plans.ts): Pro-only once PRO_GATES_ENFORCED is on.
const LINKS = [
  { href: "/onboarding?redo=1", label: "Set up again" },
  { href: "/about/data", label: "Data sources" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

/**
 * The Me page's footer (mock-c1 `.xfoot`): Sign out on the left, a small red Delete account on the
 * right, then a quiet line of links. Deleting asks for DELETE to be typed before the action enables;
 * the server checks it again.
 */
export function AccountFooter() {
  const router = useRouter();
  const inputId = useId();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut().catch(() => undefined);
    router.replace("/");
  }

  async function confirmDelete() {
    setDeleting(true);
    // Success redirects to "/" from the server action, so only a failure comes back here.
    const res = await deleteAccountAction(confirmText).catch(() => ({ ok: false as const, message: "Couldn't delete your account. Try again." }));
    setDeleting(false);
    if (res && !res.ok) toast.error(res.message);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={signingOut}
          className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded-full px-1 font-semibold whitespace-nowrap text-ink disabled:opacity-50"
        >
          <LogOut className="size-[18px]" aria-hidden />
          Sign out
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="-mr-1 inline-flex min-h-11 items-center rounded-full px-1 text-[14px] font-[550] whitespace-nowrap text-bad"
        >
          Delete account
        </button>
      </div>

      <nav aria-label="About" className="-mt-2 flex flex-wrap items-center justify-center gap-x-1 text-[12.5px] text-subtle">
        {LINKS.map((l, i) => (
          <span key={l.href} className="inline-flex items-center gap-x-1">
            {i > 0 && <span aria-hidden>·</span>}
            <Link href={l.href} className="inline-flex min-h-11 items-center px-1 whitespace-nowrap hover:text-ink">{l.label}</Link>
          </span>
        ))}
      </nav>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => {
          setDeleteOpen(v);
          if (!v) setConfirmText("");
        }}
        icon={<Trash2 />}
        title="Delete your account?"
        body={<>Your profile, diary and scans are deleted for good. This can&apos;t be undone. AI scans you&apos;ve used this month stay used if you sign up again.</>}
        confirmLabel="Delete"
        pending={deleting}
        pendingLabel="Deleting…"
        confirmDisabled={confirmText !== "DELETE"}
        onConfirm={() => void confirmDelete()}
      >
        <label htmlFor={inputId} className="mt-0.5 w-full text-left text-[13px] font-medium text-subtle">
          Type <b className="font-semibold text-ink">DELETE</b> to confirm
        </label>
        <input
          id={inputId}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="mb-1.5 h-[52px] w-full rounded-2xl border border-line bg-surface px-3.5 text-base font-semibold tracking-[0.04em] text-ink outline-none placeholder:font-normal placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-brand-deep"
        />
      </ConfirmDialog>
    </>
  );
}
