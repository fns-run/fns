import { sign, verify } from "./signature.ts"; // Adjust the path according to your file structure

const SECRET = "mySecretKey";
const INPUT = "myInputData";

// Define a timestamp for consistency
const TIMESTAMP = Date.now();

// Benchmark the `sign` function
Deno.bench("sign function", async () => {
  await sign(INPUT, SECRET, TIMESTAMP);
});

// Benchmark the `verify` function with a valid signature
Deno.bench("verify function - valid signature", async () => {
  const signature = await sign(INPUT, SECRET, TIMESTAMP);
  await verify(INPUT, SECRET, signature, { timestamp: TIMESTAMP });
});

// Benchmark the `verify` function with an invalid signature
Deno.bench("verify function - invalid signature", async () => {
  await verify(INPUT, SECRET, "invalidSignature", { timestamp: TIMESTAMP });
});
