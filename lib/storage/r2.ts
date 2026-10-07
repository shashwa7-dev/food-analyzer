// Scan photo storage (spec §A Storage): a small PhotoStore interface, its Cloudflare R2 implementation
// over the S3 API (aws4fetch signs each request; no AWS SDK), and getPhotoStore(), which is null —
// storage off, every caller a no-op — unless all four R2_* env values are set.
import { createHash } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { r2Config, type R2Config } from "@/lib/env";

export interface PhotoStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** A time-limited GET URL for one object (a presigned URL; signing is local, no request is made). */
  signedGetUrl(key: string, ttlSeconds: number): Promise<string>;
  /** Deletes every object under `prefix`, listing page by page; safe to retry after a partial run. */
  deletePrefix(prefix: string): Promise<void>;
  deleteKeys(keys: string[]): Promise<void>;
}

/** S3 caps DeleteObjects and a ListObjectsV2 page at 1000 keys. */
const BATCH = 1000;

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
const xmlUnescape = (s: string) =>
  s.replace(/&(lt|gt|amp|apos|quot|#(\d+)|#x([0-9a-f]+));/gi, (_, name: string, dec?: string, hex?: string) =>
    dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : ({ lt: "<", gt: ">", amp: "&", apos: "'", quot: '"' } as Record<string, string>)[name.toLowerCase()]!);

/** The <Key> values and the continuation token of one ListObjectsV2 page. */
export function parseListPage(xml: string): { keys: string[]; next: string | null } {
  const keys = [...xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map((m) => xmlUnescape(m[1]!));
  const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/.test(xml);
  const token = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1];
  return { keys, next: truncated && token ? xmlUnescape(token) : null };
}

export function deleteObjectsBody(keys: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Delete><Quiet>true</Quiet>${keys.map((k) => `<Object><Key>${xmlEscape(k)}</Key></Object>`).join("")}</Delete>`;
}

const md5 = (body: string) => createHash("md5").update(body).digest("base64");

/** An R2 S3-API client for one bucket. Exported for scripts/r2-lifecycle.ts. */
export function r2Client(cfg: R2Config) {
  const aws = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: "s3", region: "auto" });
  const base = `https://${cfg.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(cfg.bucket)}`;
  const objectUrl = (key: string) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  async function send(url: string, init: RequestInit, what: string): Promise<Response> {
    const res = await aws.fetch(url, init);
    if (!res.ok) throw new Error(`R2 ${what} failed: ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return res;
  }
  /** A bucket-level XML request (DeleteObjects, lifecycle) with the Content-MD5 S3 requires for them. */
  const bucketXml = (query: string, method: "POST" | "PUT", xml: string, what: string) =>
    send(`${base}?${query}`, { method, body: xml, headers: { "content-type": "application/xml", "content-md5": md5(xml) } }, what);
  return { aws, base, objectUrl, send, bucketXml };
}

export function createR2Store(cfg: R2Config): PhotoStore {
  const c = r2Client(cfg);
  const deleteKeys = async (keys: string[]) => {
    for (let i = 0; i < keys.length; i += BATCH) await c.bucketXml("delete", "POST", deleteObjectsBody(keys.slice(i, i + BATCH)), "DeleteObjects");
  };
  return {
    async put(key, bytes, contentType) {
      await c.send(c.objectUrl(key), { method: "PUT", body: bytes as BodyInit, headers: { "content-type": contentType } }, "PutObject");
    },
    async signedGetUrl(key, ttlSeconds) {
      const url = new URL(c.objectUrl(key));
      url.searchParams.set("X-Amz-Expires", String(ttlSeconds));
      return (await c.aws.sign(url.toString(), { method: "GET", aws: { signQuery: true } })).url;
    },
    deleteKeys,
    async deletePrefix(prefix) {
      // Delete each page as it is listed and list again from the start: a run cut short leaves only
      // undeleted keys behind, so calling it again finishes the job.
      for (;;) {
        const sp = new URLSearchParams({ "list-type": "2", prefix, "max-keys": String(BATCH) });
        const { keys, next } = parseListPage(await (await c.send(`${c.base}?${sp}`, { method: "GET" }, "ListObjectsV2")).text());
        if (keys.length > 0) await deleteKeys(keys);
        if (!next || keys.length === 0) return; // re-listed from the start: the deleted keys are gone
      }
    },
  };
}

let override: PhotoStore | null | undefined;
let cachedFor: string | undefined;
let cached: PhotoStore | null = null;

/** The photo store, or null when storage is off (any of the four R2 values unset). */
export function getPhotoStore(): PhotoStore | null {
  if (override !== undefined) return override;
  const cfg = r2Config();
  const id = cfg ? `${cfg.accountId}/${cfg.bucket}/${cfg.accessKeyId}` : "";
  if (id !== cachedFor) {
    cachedFor = id;
    cached = cfg ? createR2Store(cfg) : null;
  }
  return cached;
}

/** Tests only: use this store (a fake, or null for "off"); `undefined` goes back to the env. */
export function setPhotoStoreForTests(store: PhotoStore | null | undefined): void {
  override = store;
}
