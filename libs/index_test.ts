// url_test.ts
import { assert, assertEquals, assertRejects } from "../deps.ts";
import { Fns, setPerformanceCounter } from "./index.ts";
import { sign } from "./signature.ts";
import type { FnsRequestParams } from "./types.ts";

setPerformanceCounter(() => 0);

function buildInstance(name: string, data?: unknown): FnsRequestParams {
  return {
    id: Math.floor(Math.random() * 1000000000).toString(),
    run_id: Math.floor(Math.random() * 1000000000).toString(),
    name,
    data,
    steps: [],
    state: {},
    snapshot: false,
    version: 1,
    checksum: 0,
  };
}
Deno.test("DefineFirstNameAndLastName", async (t) => {
  const fns = new Fns({ dev: true, baseUrl: "none" });
  const defineWorkflow = fns.createFunction(
    { name: "DefineFirstNameAndLastName", version: 1 },
    () => async ({ step, ctx, logger }) => {
      const data = ctx.data as { prefix: string };
      assert(data.prefix, "prefix is required");
      const firstName = await step.run("define-firstname", () => {
        return "lucas";
      });
      logger.info("First name defined", { firstName });
      await step.sleep("wait-10s", "10s");
      const lastName = await step.run("define-lastname", () => {
        return "fernandes";
      });
      return `Hello ${data.prefix} ${firstName} ${lastName}`;
    },
  );
  fns.registerFunctions([defineWorkflow]);

  const initial = buildInstance("DefineFirstNameAndLastName", { prefix: "Mr" });
  const abortSignal = new AbortController().signal;
  await t.step("init define-firstname", async () => {
    const result = await fns.onHandler({
      ...initial,
      version: 1,
      checksum: fns.getConfig().checksum,
    }, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [
        {
          id: "define-firstname",
          type: "run",
          params: null,
          status: "pending",
        },
      ],
      queries: {},
      state: {},
      error: null,
      result: null,
      logs: [],
    });
  });
  await t.step("memo define-firstname", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "define-firstname",
          type: "run",
          params: null,
          status: "pending",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [
        {
          id: "define-firstname",
          status: "completed",
          elapsed: 0,
          result: "lucas",
        },
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          status: "pending",
        },
      ],
      queries: {},
      state: {},
      error: null,
      result: null,
      logs: [
        {
          level: "info",
          message: "First name defined [object Object]",
        },
      ],
    });
  });
  await t.step("define lastname", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "define-firstname",
          status: "completed",
          result: "lucas",
          type: "run",
          params: null,
        },
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          result: null,
          status: "completed",
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [{
        status: "pending",
        id: "define-lastname",
        params: null,
        type: "run",
      }],
      queries: {},
      state: {},
      error: null,
      result: null,
      logs: [],
    });
  });
  await t.step("memo lastname", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "define-firstname",
          status: "completed",
          result: "lucas",
          type: "run",
          params: null,
        },
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          result: null,
          status: "completed",
        },
        {
          status: "completed",
          id: "define-lastname",
          params: null,
          type: "run",
          result: "marie",
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "completed",
      result: "Hello Mr lucas marie",
      mutations: [],
      error: null,
      queries: {},
      state: {},
      logs: [],
    });
  });
});
Deno.test("LockerToUnlock", async (t) => {
  const fns = new Fns({ dev: true, baseUrl: "none" });
  const lockerWorkflow = fns.createFunction(
    { name: "LockerToUnlock", version: 1 },
    ({ useSignal, useQuery, useState }) => {
      const [locked, setLocked] = useState<boolean>("isLocked", true);
      useSignal("unlock", () => setLocked(false));
      useQuery("isLocked", () => locked());
      return async ({ step, ctx }) => {
        const data = ctx.data as { isLocked: boolean };
        if (data && data.isLocked !== undefined) {
          setLocked(data.isLocked);
        }
        await step.condition("wait-unlock", () => locked() === false);
        return "unlocked";
      };
    },
  );
  fns.registerFunctions([lockerWorkflow]);

  const initial = buildInstance("LockerToUnlock", { isLocked: true });
  const abortSignal = new AbortController().signal;
  await t.step("init condition", async () => {
    const result = await fns.onHandler({
      ...initial,
      version: 1,
      checksum: fns.getConfig().checksum,
    }, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [
        {
          id: "wait-unlock",
          params: null,
          type: "condition",
          status: "pending",
        },
      ],
      queries: {
        isLocked: true,
      },
      state: {},
      result: null,
      error: null,
      logs: [],
    });
  });
  await t.step("signal unlocking", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "wait-unlock",
          type: "run",
          params: null,
          result: null,
          status: "pending",
        },
        {
          id: "signal",
          type: "signal",
          params: { signal: "unlock" },
          result: null,
          status: "completed",
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
      snapshot: true,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "completed",
      result: "unlocked",
      mutations: [
        {
          id: "wait-unlock",
          result: true,
          elapsed: 0,
          status: "completed",
        },
      ],
      queries: {
        isLocked: false,
      },
      state: {
        isLocked: false,
      },
      error: null,
      logs: [],
    });
  });
});
Deno.test("CorrectConstructEvent", async (t) => {
  const fns = new Fns({ signingKey: "Hello world", baseUrl: "none" });
  const testWorkflow = fns.createFunction(
    { name: "test", version: 1 },
    () => async ({ step }) => {
      await step.sleep("wait-10s", "10s");
      return "End!";
    },
  );
  fns.registerFunctions([testWorkflow]);
  const initial = buildInstance("test", null);
  const initialRaw = JSON.stringify(initial);
  await t.step("constructEvent with valid signature", async () => {
    const signature = await sign(initialRaw, "Hello world");
    const event = await fns.constructEvent(initialRaw, signature);
    assertEquals(event, initial);
  });
  await t.step("constructEvent with invalid signature", async () => {
    const signature = await sign(initialRaw, "invalid secret");
    assertRejects(async () => await fns.constructEvent(initialRaw, signature));
  });
});
Deno.test("EfficientStateManagement", async (t) => {
  const fns = new Fns({ dev: true, baseUrl: "none" });
  const efficientStateWorkflow = fns.createFunction(
    { name: "EfficientStateManagement", version: 1 },
    ({ useState }) => {
      const [counter, setCounter] = useState<number>("counter", 0);
      return async ({ step }) => {
        await step.run("fake-step-1", () => {});
        await step.run("fake-step-2", () => {});
        await step.run("fake-step-3", () => {});
        setCounter(counter()! + 1);
        await step.run("fake-step-4", () => {});
        await step.run("fake-step-5", () => {});
        return counter();
      };
    },
  );
  fns.registerFunctions([efficientStateWorkflow]);

  const initial = buildInstance("EfficientStateManagement", null);
  const abortSignal = new AbortController().signal;
  await t.step("init state", async () => {
    const result = await fns.onHandler({
      ...initial,
      version: 1,
      checksum: fns.getConfig().checksum,
      snapshot: true,
    }, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [
        {
          id: "fake-step-1",
          type: "run",
          params: null,
          status: "pending",
        },
      ],
      queries: {},
      state: {
        counter: 0,
      },
      result: null,
      error: null,
      logs: [],
    });
  });
  await t.step("next state 1", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "fake-step-1",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
      snapshot: true,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [
        {
          id: "fake-step-2",
          type: "run",
          params: null,
          status: "pending",
        },
      ],
      queries: {},
      state: {},
      result: null,
      error: null,
      logs: [],
    });
  });
  await t.step("next state 2", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "fake-step-1",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
        {
          id: "fake-step-2",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
      snapshot: true,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [
        {
          id: "fake-step-3",
          type: "run",
          params: null,
          status: "pending",
        },
      ],
      queries: {},
      state: {},
      result: null,
      error: null,
      logs: [],
    });
  });
  await t.step("next state 3", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "fake-step-1",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
        {
          id: "fake-step-2",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
        {
          id: "fake-step-3",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
      snapshot: true,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [{
        id: "fake-step-4",
        type: "run",
        params: null,
        status: "pending",
      }],
      queries: {},
      state: {
        counter: 1,
      },
      result: null,
      error: null,
      logs: [],
    });
  });
  await t.step("next state 4", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "fake-step-1",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
        {
          id: "fake-step-2",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
        {
          id: "fake-step-3",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
        {
          id: "fake-step-4",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
      snapshot: true,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      result: null,
      mutations: [{
        id: "fake-step-5",
        type: "run",
        params: null,
        status: "pending",
      }],
      queries: {},
      state: {},
      error: null,
      logs: [],
    });
  });
  await t.step("next state 5", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "fake-step-1",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
        {
          id: "fake-step-2",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
        {
          id: "fake-step-3",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
        {
          id: "fake-step-4",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
        {
          id: "fake-step-5",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
      snapshot: true,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "completed",
      result: 1,
      mutations: [],
      queries: {},
      state: {},
      error: null,
      logs: [],
    });
  });
});
Deno.test("ErrorHandling", async (t) => {
  const fns = new Fns({ dev: true, baseUrl: "none" });
  const errorWorkflow = fns.createFunction(
    { name: "ErrorHandling", version: 1 },
    () => async ({ step }) => {
      await step.run("fake-step-1", () => {});
      await step.run("fake-step-2", () => {
        throw new Error("error");
      });
    },
  );
  fns.registerFunctions([errorWorkflow]);

  const initial = buildInstance("ErrorHandling", null);
  const abortSignal = new AbortController().signal;

  await t.step("init error", async () => {
    const result = await fns.onHandler({
      ...initial,
      version: 1,
      checksum: fns.getConfig().checksum,
    }, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [
        {
          id: "fake-step-1",
          type: "run",
          params: null,
          status: "pending",
        },
      ],
      queries: {},
      state: {},
      result: null,
      error: null,
      logs: [],
    });
  });

  await t.step("error handling", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "fake-step-1",
          type: "run",
          params: null,
          status: "completed",
          result: null,
        },
        {
          id: "fake-step-2",
          type: "run",
          params: null,
          status: "pending",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "error",
      result: null,
      mutations: [],
      queries: {},
      state: {},
      error: {
        message: "error",
        name: "Error",
        retryable: true,
        stack: result.error!.stack,
      },
      logs: [],
    });
  });
});
Deno.test("logger.info()/warn()/error()/debug()", async (t) => {
  const fns = new Fns({ dev: true, baseUrl: "none" });
  const loggerWorkflow = fns.createFunction(
    { name: "LoggerAndLevels", version: 1 },
    () => async ({ step, logger }) => {
      logger.info("info");
      logger.warn("warn");
      await step.sleep("wait-10s", "10s");
      logger.error("error");
      logger.debug("debug");
      return "End!";
    },
  );
  fns.registerFunctions([loggerWorkflow]);

  const initial = buildInstance("LoggerAndLevels", null);
  const abortSignal = new AbortController().signal;

  await t.step("init logger", async () => {
    const result = await fns.onHandler({
      ...initial,
      version: 1,
      checksum: fns.getConfig().checksum,
    }, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          status: "pending",
        },
      ],
      queries: {},
      state: {},
      result: null,
      error: null,
      logs: [
        {
          level: "info",
          message: "info",
        },
        {
          level: "warn",
          message: "warn",
        },
      ],
    });
  });

  await t.step("logger levels", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          status: "completed",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "completed",
      result: "End!",
      mutations: [],
      queries: {},
      state: {},
      error: null,
      logs: [
        {
          level: "error",
          message: "error",
        },
        {
          level: "debug",
          message: "debug",
        },
      ],
    });
  });
});
Deno.test("step.sleepUntil() - sleep until a specific time", async (t) => {
  const fns = new Fns({ dev: true, baseUrl: "none" });

  const untilDate = new Date(Date.now() + 5000);
  const sleepUntilWorkflow = fns.createFunction(
    { name: "SleepUntil", version: 1 },
    () => async ({ step }) => {
      await step.sleepUntil("wait-5s", untilDate);
      return "End!";
    },
  );
  fns.registerFunctions([sleepUntilWorkflow]);

  const initial = buildInstance("SleepUntil", null);
  const abortSignal = new AbortController().signal;

  await t.step("init sleepUntil", async () => {
    const result = await fns.onHandler({
      ...initial,
      version: 1,
      checksum: fns.getConfig().checksum,
    }, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [
        {
          id: "wait-5s",
          type: "sleep",
          params: { until: untilDate.toISOString() },
          status: "pending",
        },
      ],
      queries: {},
      state: {},
      result: null,
      error: null,
      logs: [],
    });
  });

  await t.step("sleepUntil", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "wait-5s",
          type: "sleep",
          params: { timeout: 5000 },
          status: "completed",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "completed",
      result: "End!",
      mutations: [],
      queries: {},
      state: {},
      error: null,
      logs: [],
    });
  });
});
Deno.test("step.lock()/unlock() - lock and unlock a resource", async (t) => {
  const fns = new Fns({ dev: true, baseUrl: "none" });

  const lockUnlockWorkflow = fns.createFunction(
    { name: "LockUnlock", version: 1 },
    () => async ({ step }) => {
      await step.lock("lock-resource", ["lucas-2131032"]);
      await step.unlock("lock-resource");
      return "End!";
    },
  );
  fns.registerFunctions([lockUnlockWorkflow]);

  const initial = buildInstance("LockUnlock", null);
  const abortSignal = new AbortController().signal;

  await t.step("init lockUnlock", async () => {
    const result = await fns.onHandler({
      ...initial,
      version: 1,
      checksum: fns.getConfig().checksum,
    }, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [
        {
          id: "lock-resource",
          type: "lock",
          params: {
            keys: ["lucas-2131032"],
          },
          status: "pending",
        },
      ],
      queries: {},
      state: {},
      result: null,
      error: null,
      logs: [],
    });
  });

  await t.step("lockUnlock", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "lock-resource",
          type: "lock",
          params: null,
          status: "completed",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      result: null,
      mutations: [
        {
          id: "lock-resource",
          type: "unlock",
          params: null,
          status: "pending",
        },
      ],
      queries: {},
      state: {},
      error: null,
      logs: [],
    });
  });

  await t.step("complete", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "lock-resource",
          type: "lock",
          params: null,
          status: "completed",
          result: null,
        },
        {
          id: "lock-resource",
          type: "unlock",
          params: null,
          status: "completed",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "completed",
      result: "End!",
      mutations: [],
      queries: {},
      state: {},
      error: null,
      logs: [],
    });
  });
});
Deno.test("step.repeat() - repeat a step until the timer expires", async (t) => {
  const fns = new Fns({ dev: true, baseUrl: "none" });

  const repeatWorkflow = fns.createFunction(
    { name: "Repeat", version: 1 },
    () => async ({ step, logger }) => {
      for await (
        const count of step.repeat("repeat-step", { times: 3, every: "1s" })
      ) {
        logger.info("Count", count);
      }
      return "End!";
    },
  );
  fns.registerFunctions([repeatWorkflow]);

  const initial = buildInstance("Repeat", null);
  const abortSignal = new AbortController().signal;

  await t.step("init repeat", async () => {
    const result = await fns.onHandler({
      ...initial,
      version: 1,
      checksum: fns.getConfig().checksum,
    }, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      mutations: [
        {
          id: "repeat-step-1",
          type: "sleep",
          params: {
            timeout: 1000,
          },
          status: "pending",
        },
      ],
      queries: {},
      state: {},
      result: null,
      error: null,
      logs: [{
        level: "info",
        message: "Count 1",
      }],
    });
  });

  await t.step("repeat 2", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "repeat-step-1",
          type: "sleep",
          params: {
            timeout: 1000,
          },
          status: "completed",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "incomplete",
      result: null,
      mutations: [
        {
          id: "repeat-step-2",
          type: "sleep",
          params: {
            timeout: 1000,
          },
          status: "pending",
        },
      ],
      queries: {},
      state: {},
      error: null,
      logs: [{
        level: "info",
        message: "Count 2",
      }],
    });
  });

  await t.step("repeat 3", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "repeat-step-1",
          type: "sleep",
          params: {
            timeout: 1000,
          },
          status: "completed",
          result: null,
        },
        {
          id: "repeat-step-2",
          type: "sleep",
          params: {
            timeout: 1000,
          },
          status: "completed",
          result: null,
        },
      ],
      version: 1,
      checksum: fns.getConfig().checksum,
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      status: "completed",
      result: "End!",
      mutations: [],
      queries: {},
      state: {},
      error: null,
      logs: [{
        level: "info",
        message: "Count 3",
      }],
    });
  });
});
