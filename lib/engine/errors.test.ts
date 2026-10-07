import { describe, expect, it } from "vitest";
import { EngineError } from "./errors";

describe("EngineError", () => {
  it("carries a code and is a real Error instance", () => {
    const err = new EngineError("TIMEOUT");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EngineError);
    expect(err.code).toBe("TIMEOUT");
  });
  it("accepts a custom message, defaulting to the code", () => {
    const withMessage = new EngineError("NOT_FOOD", "Not food, apparently");
    expect(withMessage.message).toBe("Not food, apparently");
    const withoutMessage = new EngineError("MODEL_ERROR");
    expect(withoutMessage.message).toBeTruthy();
  });
  it("preserves the original error as `cause` when given one", () => {
    const original = new Error("underlying failure");
    const err = new EngineError("MODEL_ERROR", "The scan couldn't be completed. Please try again.", { cause: original });
    expect(err.cause).toBe(original);
  });
});
