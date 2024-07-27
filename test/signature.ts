// Import the necessary functions from Deno's standard library
import { assertEquals, assertFalse } from "../deps.ts";

// Import the functions to be tested
import { sign, verify } from "../libs/signature.ts"; // Adjust the import path as needed

Deno.test("sign() - generate a valid signature", async () => {
  const input = "testMessage";
  const secret = "secretKey";

  const signature = await sign(input, secret);

  // Check that the signature is in the expected format
  const parts = signature.split(",");
  assertEquals(
    parts.length,
    2,
    "Signature should have two parts separated by a comma",
  );

  const timestamp = Number(parts[0]);
  assertFalse(isNaN(timestamp), "Timestamp should be a valid number");

  // Basic check for the base64 signature, should be a non-empty string
  const b64signature = parts[1];
  assertFalse(b64signature.length === 0, "Signature should not be empty");
});

Deno.test("verify() - return true for a valid signature", async () => {
  const input = "testMessage";
  const secret = "secretKey";

  // Generate a signature to verify
  const signature = await sign(input, secret);

  const isValid = await verify(input, secret, signature);
  assertEquals(isValid, true, "Signature should be valid");
});

Deno.test("verify() - return false for an expired signature", async () => {
  const input = "testMessage";
  const secret = "secretKey";

  // Generate a signature with a timestamp far in the past
  const timestamp = Date.now() - 60 * 1000; // 1 minute ago
  const signature = await sign(input, secret, timestamp);

  const isValid = await verify(input, secret, signature, {
    timeout: 30 * 1000,
  });
  assertEquals(isValid, false, "Signature should be invalid due to expiration");
});

Deno.test("verify() - return false for an invalid signature", async () => {
  const input = "testMessage";
  const secret = "secretKey";

  // Generate a signature and tamper with it
  const signature = await sign(input, secret);
  const tamperedSignature = signature.replace(/.$/, "X"); // Change last character

  const isValid = await verify(input, secret, tamperedSignature);
  assertEquals(isValid, false, "Tampered signature should be invalid");
});

Deno.test("verify() - return false if signature format is incorrect", async () => {
  const input = "testMessage";
  const secret = "secretKey";

  const invalidSignature = "invalid,signature,format";

  const isValid = await verify(input, secret, invalidSignature);
  assertEquals(isValid, false, "Incorrect signature format should be invalid");
});

Deno.test("verify() - return false if signature has a non-numeric timestamp", async () => {
  const input = "testMessage";
  const secret = "secretKey";

  const nonNumericTimestampSignature = "not-a-number,someSignature";

  const isValid = await verify(input, secret, nonNumericTimestampSignature);
  assertEquals(
    isValid,
    false,
    "Signature with non-numeric timestamp should be invalid",
  );
});
