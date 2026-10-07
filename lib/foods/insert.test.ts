import { describe, expect, it, vi } from "vitest";
import { isBarcodeUniqueViolation, retryOnBarcodeRace } from "./insert";

const barcodeRace = () => Object.assign(new Error("duplicate key value violates unique constraint \"food_barcode_uq\""), { code: "23505", constraint: "food_barcode_uq" });

describe("retryOnBarcodeRace (review N2)", () => {
  it("retries once after a food_barcode_uq violation and returns the retry's result", async () => {
    const run = vi.fn().mockRejectedValueOnce(barcodeRace()).mockResolvedValueOnce("row");
    await expect(retryOnBarcodeRace(run)).resolves.toBe("row");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("recognises the violation when Drizzle wraps the driver error in `cause`", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("Failed query", { cause: barcodeRace() })).mockResolvedValueOnce("row");
    await expect(retryOnBarcodeRace(run)).resolves.toBe("row");
  });

  it("retries only once: a second violation is thrown", async () => {
    const run = vi.fn().mockRejectedValue(barcodeRace());
    await expect(retryOnBarcodeRace(run)).rejects.toMatchObject({ code: "23505" });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("never retries other errors, including unique violations on other constraints", async () => {
    for (const err of [new Error("boom"), Object.assign(new Error("dup"), { code: "23505", constraint: "food_source_ref_uq" })]) {
      const run = vi.fn().mockRejectedValue(err);
      await expect(retryOnBarcodeRace(run)).rejects.toBe(err);
      expect(run).toHaveBeenCalledTimes(1);
    }
  });

  it("isBarcodeUniqueViolation needs both the code and the constraint", () => {
    expect(isBarcodeUniqueViolation(barcodeRace())).toBe(true);
    expect(isBarcodeUniqueViolation({ code: "23505" })).toBe(false);
    expect(isBarcodeUniqueViolation(null)).toBe(false);
  });
});
