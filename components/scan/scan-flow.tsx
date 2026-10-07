"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Barcode, ImageIcon, Camera as CameraIcon, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { CreditsPill } from "@/components/credits/credits-pill";
import { MAX_IMAGES } from "@/lib/scans/upload";
import { SCAN_MESSAGES, scanErrorAction, scanErrorMessage } from "@/lib/scans/messages";
import type { ScanView } from "@/lib/scans/service";
import type { Meal } from "@/lib/nutrition/types";
import { Camera, type CameraState } from "./camera";
import { getBarcodeReader } from "./barcode-reader";
import { compressFile, compressSource, PhotoError, UNSUPPORTED_PHOTO_MESSAGE, type CompressedPhoto } from "./compress";
import { ScanProgress } from "./scan-progress";

const SLOT_LABELS = ["Front", "Nutrition label", "Ingredients"] as const;
const NETWORK_MESSAGE = "Couldn't reach EATRi8. Check your connection and try again.";

type Photo = { id: string; blob: Blob; url: string };
type Me = { profile: { credits: number; allowance: number } };
type Problem = { code: string; message: string; kind: "barcode" | "photos" };
type PostResult = { ok: true; status: number; view: ScanView & { scanId: string } } | { ok: false; code: string; message: string };

function newKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** POST /api/v1/scans as multipart, with a fresh Idempotency-Key per press. Never throws. */
async function postScan(images: Blob[], barcode: string | null): Promise<PostResult> {
  const form = new FormData();
  images.forEach((b, i) => form.append("images", b, `photo-${i + 1}.jpg`));
  if (barcode) form.append("barcode", barcode);
  let res: Response;
  try {
    res = await fetch("/api/v1/scans", { method: "POST", body: form, headers: { "Idempotency-Key": newKey() } });
  } catch {
    return { ok: false, code: "NETWORK", message: NETWORK_MESSAGE };
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
    const code = typeof err?.code === "string" ? err.code : res.status === 413 ? "TOO_LARGE" : "MODEL_ERROR";
    return { ok: false, code, message: typeof err?.message === "string" ? err.message : scanErrorMessage(code) };
  }
  if (!body || typeof (body as { scanId?: unknown }).scanId !== "string") return { ok: false, code: "MODEL_ERROR", message: SCAN_MESSAGES.MODEL_ERROR };
  return { ok: true, status: res.status, view: body as ScanView & { scanId: string } };
}

export function ScanFlow({ meal, date, initialBarcode }: { meal: Meal | null; date: string | null; initialBarcode: string | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const takeInput = useRef<HTMLInputElement | null>(null);
  const galleryInput = useRef<HTMLInputElement | null>(null);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [barcode, setBarcode] = useState<string | null>(initialBarcode);
  const [barcodeUnknown, setBarcodeUnknown] = useState(initialBarcode !== null);
  const [submitting, setSubmitting] = useState<"barcode" | "photos" | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/api/v1/me") });

  const params = new URLSearchParams();
  if (meal) params.set("meal", meal);
  if (date) params.set("date", date);
  const query = params.toString() ? `?${params}` : "";
  const resultHref = (id: string) => `/scans/${id}${query}`;

  // Thumbnails are object URLs: revoke whatever is still shown when the screen goes away.
  const photosRef = useRef(photos);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  async function submit(kind: "barcode" | "photos", code: string | null = barcode) {
    if (submitting) return;
    setSubmitting(kind);
    setProblem(null);
    const r = await postScan(kind === "photos" ? photos.map((p) => p.blob) : [], code);
    if (!r.ok) {
      setProblem({ code: r.code, message: r.message, kind });
      setSubmitting(null);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["me"] });
    const v = r.view;
    if (v.errorCode === "BARCODE_NOT_FOUND") {
      setBarcodeUnknown(true);
      setSubmitting(null);
      return;
    }
    if (r.status === 202) {
      setRunning(v.scanId);
      setSubmitting(null);
      router.refresh(); // the nav's credit count
      return;
    }
    router.push(resultHref(v.scanId)); // stays "submitting" until the result page takes over
  }

  function onBarcode(code: string) {
    if (barcode || submitting || running) return;
    setBarcode(code);
    if (photos.length === 0) void submit("barcode", code);
  }

  async function addPhoto(p: CompressedPhoto) {
    const photo: Photo = { id: newKey(), blob: p.blob, url: URL.createObjectURL(p.blob) };
    setPhotos((cur) => (cur.length >= MAX_IMAGES ? (URL.revokeObjectURL(photo.url), cur) : [...cur, photo]));
    setPhotoError(null);
    setProblem(null);
    if (!barcode) {
      const code = await (await getBarcodeReader()).read(p.canvas);
      if (code) setBarcode((cur) => cur ?? code); // sent with the photos; a known barcode makes the scan free
    }
  }

  async function capture() {
    const v = videoRef.current;
    if (!v || camera !== "live" || photos.length >= MAX_IMAGES) return;
    setCapturing(true);
    try {
      // "live" can arrive a moment before the first frame (and again after a tab-switch restart).
      if (!v.videoWidth) await new Promise((r) => { v.addEventListener("loadeddata", r, { once: true }); setTimeout(r, 2000); });
      if (!v.videoWidth) return;
      await addPhoto(await compressSource(v, v.videoWidth, v.videoHeight));
    } catch (e) {
      setPhotoError(e instanceof PhotoError ? e.message : UNSUPPORTED_PHOTO_MESSAGE);
    } finally {
      setCapturing(false);
    }
  }

  async function onFiles(files: FileList | null, input: HTMLInputElement | null) {
    const list = Array.from(files ?? []).slice(0, MAX_IMAGES - photos.length);
    if (input) input.value = ""; // the same file can be picked again after removing it
    setCapturing(true);
    try {
      for (const f of list) {
        try {
          await addPhoto(await compressFile(f));
        } catch (e) {
          setPhotoError(e instanceof PhotoError ? e.message : UNSUPPORTED_PHOTO_MESSAGE);
        }
      }
    } finally {
      setCapturing(false);
    }
  }

  function removePhoto(id: string) {
    setPhotos((cur) => {
      const gone = cur.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return cur.filter((p) => p.id !== id);
    });
  }

  function startOver() {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setBarcode(null);
    setBarcodeUnknown(false);
    setProblem(null);
    setPhotoError(null);
  }

  if (running) return <ScanProgress scanId={running} onFinished={() => router.replace(resultHref(running))} />;

  const n = photos.length;
  const full = n >= MAX_IMAGES;
  const detecting = !barcode && !submitting && !full;
  const live = camera === "live";
  const action = problem ? scanErrorAction(problem.code) : null;

  const pill = submitting === "barcode"
    ? <><Barcode className="size-4" aria-hidden /> Barcode found — looking it up</>
    : barcodeUnknown
      ? <><Barcode className="size-4" aria-hidden /> Unknown barcode · take a photo of the label</>
      : barcode
        ? <><Barcode className="size-4" aria-hidden /> Barcode added to your photos</>
        : <><Barcode className="size-4" aria-hidden /> No barcode yet · take a photo</>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="title text-[30px] md:text-[34px]">Scan</h1>
        {me.data && <CreditsPill credits={me.data.profile.credits} />}
      </div>

      <Camera videoRef={videoRef} detecting={detecting} onBarcode={onBarcode} onStateChange={setCamera} status={pill} />

      <input ref={takeInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => void onFiles(e.target.files, e.target)} />
      <input ref={galleryInput} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => void onFiles(e.target.files, e.target)} />

      {camera !== "denied" && camera !== "unavailable" ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Button variant="outline" className="h-11 justify-self-start px-3.5" disabled={full || capturing} onClick={() => galleryInput.current?.click()}>
            <ImageIcon aria-hidden /> Gallery
          </Button>
          <button
            type="button"
            aria-label="Take photo"
            disabled={!live || full || capturing}
            onClick={() => void capture()}
            className="grid size-[76px] place-items-center rounded-full border-[5px] border-ink disabled:opacity-40"
          >
            <span className="size-[58px] rounded-full bg-accent" />
          </button>
          <Button variant="outline" className="h-11 justify-self-end px-3.5" disabled={full || capturing} onClick={() => takeInput.current?.click()}>
            <CameraIcon aria-hidden /> Camera app
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button className="h-12" disabled={full || capturing} onClick={() => takeInput.current?.click()}>
            <CameraIcon aria-hidden /> Take photo
          </Button>
          <Button variant="outline" className="h-12" disabled={full || capturing} onClick={() => galleryInput.current?.click()}>
            <ImageIcon aria-hidden /> Choose from gallery
          </Button>
        </div>
      )}

      <ul className="flex flex-wrap gap-2.5" aria-label="Photos">
        {SLOT_LABELS.map((label, i) => {
          const p = photos[i];
          return (
            <li key={label} className="relative">
              {p ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, never stored or optimised */}
                  <img src={p.url} alt={`Photo ${i + 1}: ${label}`} className="size-[76px] rounded-md border border-line object-cover" />
                  <span className="absolute inset-x-0 bottom-0 rounded-b-md bg-viewfinder/70 px-1 py-0.5 text-center text-xs font-semibold text-on-media">{label}</span>
                  <button type="button" onClick={() => removePhoto(p.id)} aria-label={`Remove photo ${i + 1}`}
                    className="absolute -right-3 -top-3 grid size-11 place-items-center">
                    <span className="grid size-6 place-items-center rounded-full bg-ink text-bg"><X className="size-3.5" aria-hidden /></span>
                  </button>
                </>
              ) : (
                <div className="grid size-[76px] place-items-center rounded-md border border-dashed border-line px-1 text-center text-xs font-semibold text-subtle">
                  <span>{label}{i === 2 && <><br />(optional)</>}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {photoError && <p role="alert" className="text-sm text-bad">{photoError}</p>}
      {barcodeUnknown && !problem && <p className="rounded-md border border-line bg-surface p-3.5 text-sm">{SCAN_MESSAGES.BARCODE_NOT_FOUND}</p>}

      {problem && (
        <div role="alert" className="flex flex-col gap-2.5 rounded-md border border-bad p-3.5 text-sm">
          <p>{problem.message}</p>
          {action?.kind === "credits" && <Link href="/me/credits" className="flex min-h-11 items-center font-semibold text-accent">{action.label}</Link>}
          {action?.kind === "retry" && <Button variant="outline" className="h-11 self-start" onClick={() => void submit(problem.kind)}>{action.label}</Button>}
          {action?.kind === "rescan" && <Button variant="outline" className="h-11 self-start" onClick={startOver}>{action.label}</Button>}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {n > 0 ? (
          <Button className="h-12 w-full text-base" disabled={submitting !== null || capturing} onClick={() => void submit("photos")}>
            {submitting === "photos" ? "Sending…" : `Analyse ${n} photo${n > 1 ? "s" : ""} · uses 1 AI scan`}
          </Button>
        ) : (
          <p className="text-sm text-subtle">Tip: a photo of the nutrition label gives exact numbers. A barcode is free and instant.</p>
        )}
        {barcode && n === 0 && submitting === null && (
          <Button variant="ghost" className="h-11" onClick={startOver}>Scan a different barcode</Button>
        )}
      </div>
    </div>
  );
}
