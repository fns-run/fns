const SECONDS30 = 1 * 30 * 1000;

export const sign = async (
  input: string,
  secret: string,
  timestamp: number = Date.now(),
) => {
  const cryptoLib = globalThis.crypto
    ? globalThis.crypto
    : await import("node:crypto");
  const signature = await cryptoLib.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret + input + timestamp),
  );
  const b64signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return [timestamp, b64signature].join(",");
};
export const verify = async (
  input: string,
  secret: string,
  signature: string,
  opts: { timeout?: number; timestamp?: number } = {},
) => {
  const cryptoLib = globalThis.crypto
    ? globalThis.crypto
    : await import("node:crypto");
  if (!signature) return false;
  const match = signature.split(",", 2);
  if (match.length !== 2) return false;

  const poststamp = Number(match[0]);
  if (isNaN(poststamp)) return false;
  const postDigest = match[1];

  const timestamp = opts?.timestamp ?? Date.now();
  const timeout = opts?.timeout ?? SECONDS30;

  if (timestamp - poststamp > timeout) return false;

  const computedSignature = await cryptoLib.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret + input + poststamp),
  );
  const b64computedSignature = btoa(
    String.fromCharCode(...new Uint8Array(computedSignature)),
  );
  return b64computedSignature === postDigest;
};
