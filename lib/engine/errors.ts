export type EngineErrorCode = "UNREADABLE_IMAGE" | "NOT_FOOD" | "MODEL_ERROR" | "TIMEOUT" | "BARCODE_NOT_FOUND";

export class EngineError extends Error {
  constructor(public code: EngineErrorCode, message?: string, options?: ErrorOptions) {
    super(message ?? code, options);
    this.name = "EngineError";
  }
}
