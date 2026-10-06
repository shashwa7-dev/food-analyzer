"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export function FoodOwnerActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const del = useMutation({
    mutationFn: () => api(`/api/v1/foods/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Deleted. Past diary entries keep their values.");
      router.push("/foods");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't delete that. Try again."),
  });
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/foods/new?edit=${id}`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line px-3.5 text-sm font-semibold"
      >
        <Pencil className="size-4" aria-hidden /> Edit
      </Link>
      <Button type="button" variant="outline" className="h-11 gap-1.5 px-3.5 text-sm" onClick={() => setConfirmOpen(true)}>
        <Trash2 className="size-4" aria-hidden /> Delete
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>This removes it from search and My foods. Past diary entries keep their values.</DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="button" variant="destructive" disabled={del.isPending} onClick={() => del.mutate()}>
              {del.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
