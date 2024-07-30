import { assertEquals, assertInstanceOf } from "../deps.ts";
import { NonRetriableError } from "./errors.ts";

Deno.test("NonRetriableError: Should have correct name and message", () => {
  const errorMessage = "This is a non-retriable error";
  const error = new NonRetriableError(errorMessage);

  assertInstanceOf(error, NonRetriableError);
  assertEquals(error.name, "NonRetriableError");
  assertEquals(error.message, errorMessage);
});

Deno.test("NonRetriableError: Should default to an empty message", () => {
  const error = new NonRetriableError();

  assertInstanceOf(error, NonRetriableError);
  assertEquals(error.name, "NonRetriableError");
  assertEquals(error.message, "");
});

Deno.test("NonRetriableError: Should have correct prototype chain", () => {
  const error = new NonRetriableError();

  // Check if the prototype chain is correctly set up
  assertEquals(Object.getPrototypeOf(error), NonRetriableError.prototype);
  assertEquals(Object.getPrototypeOf(NonRetriableError.prototype), Error.prototype);
});