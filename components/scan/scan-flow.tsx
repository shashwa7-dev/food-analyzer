"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Barcode, ChevronLeft, ImageIcon, Sparkles, TriangleAlert, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { MAX_IMAGES } from "@/lib/scans/upload";
import { RETRY_ACTION, SCAN_MESSAGES, scanErrorAction, scanErrorMessage } from "@/lib/scans/messages";
import { MODE_HINT, type ScanMode } from "@/lib/scans/modes";
import type { ScanView } from "@/lib/scans/service";
import type { Meal } from "@/lib/nutrition/types";
import { backAction, readInAppNav } from "@/lib/nav/back";
import { cn } from "@/lib/utils";
import { Camera, type CameraState } from "./camera";
import { getBarcodeReader } from "./barcode-reader";
import { CAMERA_NOT_READY_MESSAGE, compressFile, compressSource, PhotoError, UNSUPPORTED_PHOTO_MESSAGE, type CompressedPhoto } from "./compress";
import { AnalysingCard } from "./analysing-card";
import { ModeTiles } from "./mode-tiles";
import { ReviewTray } from "./review-tray";
import { ROUND_ON_MEDIA, ScanStage } from "./scan-stage";

const NETWORK_MESSAGE = "Couldn't reach EATRi8. Check your connection and try again.";

type Photo = { id: string; blob: Blob; url: string };
type Me = { profile: { credits: number; allowance: number } };
type Problem = { code: string; message: string; kind: "barcode" | "photos" };
type PostResult = { ok: true; status: number; view: ScanView & { scanId: string } } | { ok: false; code: string; message: string };

function newKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** POST /api/v1/scans as multipart with the given Idempotency-Key. Never throws. */
async function postScan(images: Blob[], barcode: string | null, key: string): Promise<PostResult> {
  const form = new FormData();
  images.forEach((b, i) => form.append("images", b, `photo-${i + 1}.jpg`));
  if (barcode) form.append("barcode", barcode);
  let res: Response;
  try {
    res = await fetch("/api/v1/scans", { method: "POST", body: form, headers: { "Idempotency-Key": key } });
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

/** A white card on the camera for errors and barcode news (above the mode tiles, or inside the tray). */
function Notice({ tone = "info", children }: { tone?: "info" | "bad"; children: ReactNode }) {
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-2.5 rounded-[20px] p-3.5 text-[14px] leading-snug text-ink",
        tone === "bad" ? "bg-surface ring-1 ring-bad/40" : "bg-surface",
      )}
    >
      {children}
    </div>
  );
}

const NOTICE_ACTION = "self-start";

/**
 * /scan (spec §6.8–6.10): the full-screen camera with mode tiles and the shutter; after a photo, the
 * review tray over that photo; after "Analyse photos", the Analysing card until the result is ready.
 * Barcode detection runs in every mode: a barcode hit with no photos goes straight to the result.
 */
export function ScanFlow({ meal, date, initialBarcode, initialMode }: {
  meal: Meal | null; date: string | null; initialBarcode: string | null; initialMode: ScanMode;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const takeInput = useRef<HTMLInputElement | null>(null);
  const galleryInput = useRef<HTMLInputElement | null>(null);
  const [camera, setCamera] = useState<CameraState>("starting");
  // Back from "We don't know this barcode": the label photo is what's needed next.
  const [mode, setMode] = useState<ScanMode>(initialBarcode ? "label" : initialMode);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  // True while back on the camera from the tray's add slot (or Back), with photos already taken.
  const [adding, setAdding] = useState(false);
  const [barcode, setBarcode] = useState<string | null>(initialBarcode);
  const [barcodeUnknown, setBarcodeUnknown] = useState(initialBarcode !== null);
  const [submitting, setSubmitting] = useState<"barcode" | "photos" | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/api/v1/me") });
  // One Idempotency-Key per photo set + barcode: re-sending the same set after a dropped connection
  // replays the scan the server may already have accepted instead of charging again.
  const sendKey = useRef<{ sig: string; key: string } | null>(null);
  function keyFor(sig: string): string {
    if (sendKey.current?.sig !== sig) sendKey.current = { sig, key: newKey() };
    return sendKey.current.key;
  }

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
    const sent = kind === "photos" ? photos : [];
    const r = await postScan(sent.map((p) => p.blob), code, keyFor(`${sent.map((p) => p.id).join(",")}|${code ?? ""}`));
    if (!r.ok) {
      setProblem({ code: r.code, message: r.message, kind });
      setSubmitting(null);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["me"] });
    void qc.invalidateQueries({ queryKey: ["scans"] }); // the new scan (queued/done) belongs in /history now
    const v = r.view;
    if (v.errorCode === "BARCODE_NOT_FOUND") {
      setBarcodeUnknown(true);
      setMode("label");
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
    // Show the new photo behind the tray (an id that didn't fit just falls back to the last one).
    setSelected(photo.id);
    setAdding(false);
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
      if (!v.videoWidth) {
        await new Promise<void>((resolve) => {
          const done = () => { clearTimeout(timer); v.removeEventListener("loadeddata", done); resolve(); };
          const timer = setTimeout(done, 2000);
          v.addEventListener("loadeddata", done);
        });
      }
      if (!v.videoWidth) {
        setPhotoError(CAMERA_NOT_READY_MESSAGE);
        return;
      }
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
    const rest = photos.filter((p) => p.id !== id);
    const gone = photos.find((p) => p.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    setPhotos(rest);
    if (selected === id) setSelected(rest.at(-1)?.id ?? null);
  }

  function startOver() {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setSelected(null);
    setAdding(false);
    setBarcode(null);
    setBarcodeUnknown(false);
    setProblem(null);
    setPhotoError(null);
  }

  /** Leave the scanner: back to the app page it was opened from, else Today. */
  function leave() {
    const action = backAction(readInAppNav(), date ? `/today?date=${date}` : "/today");
    if (action.kind === "back") router.back();
    else router.push(action.href);
  }

  if (running) {
    const last = photos.at(-1)?.url ?? null;
    return <AnalysingCard scanId={running} photoUrl={last} onFinished={() => router.replace(resultHref(running))} />;
  }

  const n = photos.length;
  const full = n >= MAX_IMAGES;
  const reviewing = n > 0 && !adding;
  const detecting = !barcode && !submitting && !full;
  const live = camera === "live";
  const blocked = camera === "denied" || camera === "unavailable";
  const shown = photos.find((p) => p.id === selected) ?? photos.at(-1);
  // A dropped connection: re-send the same photos (same key, so never a second charge).
  const action = problem ? (problem.code === "NETWORK" ? RETRY_ACTION : scanErrorAction(problem.code)) : null;
  const credits = me.data?.profile.credits;

  const hint = submitting === "barcode"
    ? "Barcode found, looking it up…"
    : barcodeUnknown
      ? "Unknown barcode · photograph the label"
      : barcode && n > 0
        ? "Barcode added to your photos"
        : !live && !blocked
          ? "Starting the camera…"
          : MODE_HINT[mode];

  const notices = (
    <>
      {photoError && <Notice tone="bad"><p className="m-0">{photoError}</p></Notice>}
      {barcodeUnknown && !problem && (
        <Notice>
          <p className="m-0 flex items-start gap-2"><Barcode className="mt-px size-4 shrink-0 text-brand-deep" aria-hidden />{SCAN_MESSAGES.BARCODE_NOT_FOUND}</p>
          {n === 0 && submitting === null && (
            <Button type="button" variant="ghost-sunken" shape="pill" size="lg" className={NOTICE_ACTION} onClick={startOver}>Scan a different barcode</Button>
          )}
        </Notice>
      )}
      {problem && (
        <Notice tone="bad">
          <p className="m-0 flex items-start gap-2"><TriangleAlert className="mt-px size-4 shrink-0 text-bad" aria-hidden />{problem.message}</p>
          {action?.kind === "credits" && (
            <Button render={<Link href="/me/credits" />} nativeButton={false} variant="ghost-sunken" shape="pill" size="lg" className={NOTICE_ACTION}>{action.label}</Button>
          )}
          {action?.kind === "retry" && (
            <Button type="button" variant="ghost-sunken" shape="pill" size="lg" className={NOTICE_ACTION} onClick={() => void submit(problem.kind)}>{action.label}</Button>
          )}
          {action?.kind === "rescan" && (
            <Button type="button" variant="ghost-sunken" shape="pill" size="lg" className={NOTICE_ACTION} onClick={startOver}>{action.label}</Button>
          )}
        </Notice>
      )}
    </>
  );
  const hasNotice = !!photoError || (barcodeUnknown && !problem) || !!problem;

  return (
    <ScanStage label="Scanner">
      <Camera videoRef={videoRef} detecting={detecting} onBarcode={onBarcode} onStateChange={setCamera} />
      <input ref={takeInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => void onFiles(e.target.files, e.target)} />
      <input ref={galleryInput} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => void onFiles(e.target.files, e.target)} />

      {reviewing && shown && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, never stored or optimised
        <img src={shown.url} alt="" aria-hidden className="absolute inset-0 size-full object-cover" />
      )}
      <div aria-hidden className="scan-scrim pointer-events-none absolute inset-0" />

      <div className="relative flex items-center justify-between gap-3 px-[18px] pt-2 pb-2">
        <button type="button" onClick={() => (n > 0 && adding ? setAdding(false) : reviewing ? setAdding(true) : leave())}
          aria-label={n > 0 && adding ? "Back to your photos" : reviewing ? "Back to the camera" : "Back"} className={ROUND_ON_MEDIA}>
          <ChevronLeft aria-hidden />
        </button>
        <h1 className="m-0 truncate text-[17px] font-semibold whitespace-nowrap">
          {reviewing ? `${n} photo${n > 1 ? "s" : ""}` : "Scan"}
        </h1>
        <button type="button" onClick={leave} aria-label="Close the scanner" className={ROUND_ON_MEDIA}>
          <X aria-hidden />
        </button>
      </div>

      {reviewing ? (
        <ReviewTray
          photos={photos}
          selected={shown?.id ?? null}
          onSelect={setSelected}
          onRemove={removePhoto}
          onAdd={full ? null : () => (blocked ? takeInput.current?.click() : setAdding(true))}
          mode={mode}
          onAnalyse={() => void submit("photos")}
          pending={submitting === "photos"}
          disabled={submitting !== null || capturing}
          notice={hasNotice ? <div className="grid gap-2 [&>[role]]:bg-sunken [&>[role]]:ring-0">{notices}</div> : null}
        />
      ) : (
        <>
          {!blocked && (
            <div aria-hidden className="pointer-events-none relative mx-auto mt-[26px] h-[min(300px,36dvh)] w-[250px] max-w-[calc(100%-64px)] shrink-0">
              <i className="absolute top-0 left-0 size-[46px] rounded-tl-[22px] border-t-[3px] border-l-[3px] border-on-media" />
              <i className="absolute top-0 right-0 size-[46px] rounded-tr-[22px] border-t-[3px] border-r-[3px] border-on-media" />
              <i className="absolute bottom-0 left-0 size-[46px] rounded-bl-[22px] border-b-[3px] border-l-[3px] border-on-media" />
              <i className="absolute right-0 bottom-0 size-[46px] rounded-br-[22px] border-r-[3px] border-b-[3px] border-on-media" />
              {mode === "barcode" && live && (
                <span className="absolute inset-x-2.5 top-[52%] h-0.5 rounded-full bg-brand shadow-[0_0_12px_var(--brand)] motion-safe:animate-laser" />
              )}
            </div>
          )}
          <p role="status" aria-live="polite"
            className={cn(
              "relative mx-auto mb-0 max-w-[calc(100%-32px)] truncate rounded-full bg-viewfinder/55 px-3.5 py-2 text-[13px] font-medium whitespace-nowrap backdrop-blur-[8px]",
              blocked ? "mt-auto" : "mt-[18px]",
            )}>
            {hint}
          </p>

          <div className="relative mt-auto flex w-full flex-col gap-3 px-4 pt-4 md:mx-auto md:max-w-[480px]">
            {hasNotice && <div className="grid gap-2">{notices}</div>}
            <ModeTiles mode={mode} onPick={setMode} />
          </div>
          <div className="relative flex w-full items-center justify-between px-[34px] pt-[18px] pb-[26px] md:mx-auto md:max-w-[480px]">
            <button type="button" aria-label="Choose from gallery" disabled={full || capturing} onClick={() => galleryInput.current?.click()}
              className="grid size-12 place-items-center rounded-[14px] border-2 border-on-media bg-on-media/15 backdrop-blur-[10px] transition-colors hover:bg-on-media/25 disabled:opacity-40">
              <ImageIcon className="size-[22px]" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Take photo"
              disabled={full || capturing || (!live && !blocked)}
              onClick={() => (blocked ? takeInput.current?.click() : void capture())}
              className="grid size-[78px] place-items-center rounded-full border-4 border-on-media transition-transform active:scale-95 disabled:opacity-40"
            >
              <span className={cn("size-[60px] rounded-full bg-brand", capturing && "motion-safe:animate-pulse")} />
            </button>
            {credits === undefined ? (
              <span className="size-12" aria-hidden />
            ) : (
              <Link href="/me/credits" aria-label={`${credits} AI scan${credits === 1 ? "" : "s"} left`}
                className="num grid h-12 min-w-12 place-items-center rounded-3xl bg-viewfinder/50 px-2.5 text-center text-[12px] leading-[1.1] font-semibold">
                <Sparkles className="size-4" aria-hidden />
                {credits}
              </Link>
            )}
          </div>
        </>
      )}
    </ScanStage>
  );
}
