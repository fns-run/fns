import crypto from 'node:crypto'

const SECONDS30 = 1 * 30 * 1000;

export const sign = async(
  input: string,
  secret: string,
  timestamp: number = Date.now()
) => {
  const signature = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret + input + timestamp));
  const b64signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${timestamp},${b64signature}`;
}
export const verify = async(
  input: string,
  secret: string,
  signature: string,
  opts: { timeout?: number; timestamp?: number } = {}
) => {
  const match = signature.split(",", 2);
  if (match.length !== 2) {
    return false;
  }

  const poststamp = Number(match[1]);
  const postDigest = match[2];

  const timestamp = opts?.timestamp ?? Date.now();
  const timeout = opts?.timeout ?? SECONDS30;

  const difference = Math.abs(timestamp - poststamp);
  if (difference > timeout) {
    return false;
  }
  const computedSignature = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret + input + poststamp));
  const b64computedSignature = btoa(String.fromCharCode(...new Uint8Array(computedSignature)));
  return b64computedSignature === postDigest;
}
