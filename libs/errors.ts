export class NonRetriableError extends Error {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, NonRetriableError.prototype);
    this.name = "NonRetriableError";
  }
}
