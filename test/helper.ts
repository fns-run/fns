import { assertEquals, assertRejects } from "../deps.ts";
import { block, execute, resolveNextTick } from "../libs/helper.ts";

Deno.test("resolveNextTick() - resolves after next tick", async () => {
  const timeouts: number[] = [];
  let resolved = false;

  // Create a promise to test the resolveNextTick function
  const promise = resolveNextTick(timeouts).then(() => {
    resolved = true;
  });

  // Ensure the timeout was set
  assertEquals(
    timeouts.length,
    1,
    "Timeouts array should contain one timeout ID",
  );

  // Initially, the promise should not be resolved
  assertEquals(resolved, false, "Promise should not be resolved immediately");

  // Wait for the promise to resolve
  await promise;

  // After the promise resolves, `resolved` should be true
  assertEquals(resolved, true, "Promise should be resolved after next tick");
});

Deno.test("execute() - returns true and value for resolved promise", async () => {
  const value = "resolvedValue";
  const promise = Promise.resolve(value);

  const result = await execute(promise);
  assertEquals(result, [true, value], "Should return [true, resolvedValue]");
});

Deno.test("execute() - returns false and null for unresolved promise", async () => {
  const promise = block();

  const result = await execute(promise);
  assertEquals(
    result,
    [false, null],
    "Should return [false, null] for unresolved promise",
  );
});

Deno.test("execute() - handles promise rejection", async () => {
  const promise = Promise.reject(new Error("Test error"));

  await assertRejects(
    async () => {
      await execute(promise);
    },
    Error,
    "Test error",
    "Should throw an error for rejected promise",
  );
});

Deno.test("block() - creates a promise that never resolves", async () => {
  const promise = block();

  let resolved = false;
  let rejected = false;

  promise
    .then(() => {
      resolved = true;
    })
    .catch(() => {
      rejected = true;
    });

  // Allow some time for promise resolution (it should not resolve or reject)
  await new Promise((resolve) => setTimeout(resolve, 100));

  assertEquals(resolved, false, "Promise should not resolve");
  assertEquals(rejected, false, "Promise should not reject");
});
