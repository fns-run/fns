export class NonRetriableError extends Error {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, NonRetriableError.prototype);
    this.name = "NonRetriableError";
  }
}
export class SignatureVerificationError extends NonRetriableError {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, SignatureVerificationError.prototype);
    this.name = "SignatureVerificationError";
  }
}
export class InvalidSignatureError extends NonRetriableError {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, InvalidSignatureError.prototype);
    this.name = "InvalidSignatureError";
  }
}
export class SigningKeyRequiredError extends NonRetriableError {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, SigningKeyRequiredError.prototype);
    this.name = "SigningKeyRequiredError";
  }
}
export class FunctionNotFoundError extends NonRetriableError {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, FunctionNotFoundError.prototype);
    this.name = "FunctionNotFoundError";
  }
}
