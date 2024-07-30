import { block, execute, resolveNextTick } from "./helper.ts"; // Adjust the path according to your file structure

// Define a promise that resolves immediately
const resolvedPromise = Promise.resolve("immediate");

// Benchmark the `resolveNextTick` function
Deno.bench("resolveNextTick", async () => {
  const timeouts: number[] = [];
  await resolveNextTick(timeouts);
});

// Benchmark the `execute` function with a resolved promise
Deno.bench("execute - resolved promise", async () => {
  await execute(resolvedPromise);
});

// Benchmark the `block` function
Deno.bench("block", async () => {
  try {
    await block();
  } catch {
    // Handle errors for benchmarking
  }
});
