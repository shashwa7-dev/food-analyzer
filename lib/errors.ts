export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
export class InvalidError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidError";
  }
}
export class ProRequiredError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ProRequiredError";
  }
}
