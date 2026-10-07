import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOffByBarcode, lookupOffByBarcode } from "./off";

// No network: fetchImpl is always an injected fake. Each fake mirrors the real OFF v2 API's
// response shape closely enough to exercise fetchOffByBarcode's own branching.
function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

const PRODUCT = {
  code: "8901491101837", product_name: "Aloo Bhujia", brands: "Sample", categories_tags: ["en:snacks"],
  nutriments: { "energy-kcal_100g": 554, proteins_100g: 11, carbohydrates_100g: 51.7, fat_100g: 34, sugars_100g: 2, sodium_100g: 1.05 },
  serving_quantity: 30, product_quantity: 200, nova_group: 4, additives_tags: ["en:e627"], allergens_tags: [],
  traces_tags: ["en:peanuts", "en:milk"], ingredients_text: "gram flour, palmolein, salt",
  countries_tags: ["en:india", "en:united-arab-emirates"],
};

describe("fetchOffByBarcode", () => {
  afterEach(() => {
    delete process.env.OFF_CONTACT_EMAIL;
  });

  it("maps a found product, including countries_tags -> countries and traces_tags -> mayContain", async () => {
    const fake = vi.fn(async () => okJson({ status: 1, product: PRODUCT }));
    const rec = await fetchOffByBarcode("8901491101837", fake);
    expect(rec).toMatchObject({ source: "off", sourceRef: "8901491101837", name: "Aloo Bhujia", brand: "Sample" });
    expect(rec!.countries).toEqual(["IN", "AE"]);
    expect(rec!.mayContain).toEqual(["en:peanuts", "en:milk"]);
  });

  it("requests the v2 product endpoint with the required fields (incl. countries_tags) and a User-Agent", async () => {
    const fake = vi.fn<typeof fetch>().mockResolvedValue(okJson({ status: 1, product: PRODUCT }));
    await fetchOffByBarcode("8901491101837", fake);
    expect(fake).toHaveBeenCalledTimes(1);
    const [url, opts] = fake.mock.calls[0]!;
    expect(String(url)).toBe("https://world.openfoodfacts.org/api/v2/product/8901491101837?fields=code,product_name,brands,categories_tags,nutriments,serving_quantity,product_quantity,nova_group,additives_tags,allergens_tags,traces_tags,ingredients_text,nutrition_grades,countries_tags");
    const headers = opts!.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("EATRi8/2.0 (contact via app)");
    expect(opts!.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses OFF_CONTACT_EMAIL in the User-Agent when set", async () => {
    process.env.OFF_CONTACT_EMAIL = "ops@eatri8.app";
    const fake = vi.fn<typeof fetch>().mockResolvedValue(okJson({ status: 1, product: PRODUCT }));
    await fetchOffByBarcode("8901491101837", fake);
    const [, opts] = fake.mock.calls[0]!;
    const headers = opts!.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("EATRi8/2.0 (ops@eatri8.app)");
  });

  it("returns null when the product is not found (status: 0)", async () => {
    const fake = vi.fn(async () => okJson({ status: 0, status_verbose: "product not found" }));
    expect(await fetchOffByBarcode("0000000000000", fake)).toBeNull();
  });

  it("returns null on a 404 response", async () => {
    const fake = vi.fn(async () => new Response("not found", { status: 404 }));
    expect(await fetchOffByBarcode("0000000000000", fake)).toBeNull();
  });

  it("returns null on a non-ok response other than 404 (e.g. 503)", async () => {
    const fake = vi.fn(async () => new Response("busy", { status: 503 }));
    expect(await fetchOffByBarcode("8901491101837", fake)).toBeNull();
  });

  it("returns null on a network error", async () => {
    const fake = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await fetchOffByBarcode("8901491101837", fake)).toBeNull();
  });

  it("returns null when the body is malformed JSON", async () => {
    const fake = vi.fn(async () => new Response("not json {{{", { status: 200 }));
    expect(await fetchOffByBarcode("8901491101837", fake)).toBeNull();
  });

  it("returns null when the product is missing required macros (toSourceRecordOFF rejects it)", async () => {
    const fake = vi.fn(async () => okJson({ status: 1, product: { code: "0000000000000", product_name: "x", nutriments: {} } }));
    expect(await fetchOffByBarcode("0000000000000", fake)).toBeNull();
  });

  it("returns null when status is 1 but no product is present", async () => {
    const fake = vi.fn(async () => okJson({ status: 1 }));
    expect(await fetchOffByBarcode("0000000000000", fake)).toBeNull();
  });

  it("rejects an invalid barcode before making any request", async () => {
    const fake = vi.fn<typeof fetch>().mockResolvedValue(okJson({ status: 1, product: PRODUCT }));
    expect(await fetchOffByBarcode("12?x=1", fake)).toBeNull();
    expect(await fetchOffByBarcode("abc", fake)).toBeNull();
    expect(fake).not.toHaveBeenCalled();
  });

  it("requests a UPC-A barcode in its normalised EAN-13 form", async () => {
    const fake = vi.fn<typeof fetch>().mockResolvedValue(okJson({ status: 1, product: PRODUCT }));
    await fetchOffByBarcode("036000291452", fake); // valid UPC-A (12 digits) -> EAN-13 "0036000291452"
    const [url] = fake.mock.calls[0]!;
    expect(String(url)).toContain("/api/v2/product/0036000291452?");
  });
});

describe("lookupOffByBarcode (final review I3: only a definitive miss lets a crowd row claim a barcode)", () => {
  const status = async (res: () => Response | Promise<Response>, code = "8901491101837") =>
    (await lookupOffByBarcode(code, vi.fn(async () => res()))).status;

  it("found for a usable product", async () => {
    expect(await status(() => okJson({ status: 1, product: PRODUCT }))).toBe("found");
  });
  it("not_found only for OFF's own definitive answers: 404, or 200 with status 0", async () => {
    expect(await status(() => new Response("not found", { status: 404 }))).toBe("not_found");
    expect(await status(() => okJson({ status: 0, status_verbose: "product not found" }))).toBe("not_found");
  });
  it("unavailable for timeouts, network/HTTP errors, bad bodies and unusable products", async () => {
    expect(await status(() => { throw new TypeError("fetch failed"); })).toBe("unavailable");
    expect(await status(() => new Response("busy", { status: 503 }))).toBe("unavailable");
    expect(await status(() => new Response("not json {{{", { status: 200 }))).toBe("unavailable");
    expect(await status(() => okJson({ status: 1 }))).toBe("unavailable");
    expect(await status(() => okJson({ status: 1, product: { code: "8901491101837", product_name: "x", nutriments: {} } }))).toBe("unavailable");
    expect(await status(() => okJson({ status: 1, product: PRODUCT }), "12?x=1")).toBe("unavailable");
  });
});
