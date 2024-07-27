import { assert, assertEquals, assertRejects } from "../deps.ts";
import { Fns, setPerformanceCounter } from "../libs/index.ts";
import { sign } from "../libs/signature.ts";
import type { FnsRequestParams } from "../libs/types.ts";

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
  };
}
Deno.test("DefineFirstNameAndLastName", async (t) => {
  const fns = new Fns({ dev: true });
  fns.createFunction(
    { name: "DefineFirstNameAndLastName", version: 1 },
    () => async ({ step, ctx }) => {
      const data = ctx.data as { prefix: string };
      assert(data.prefix, "prefix is required");
      const firstName = await step.run("define-firstname", () => {
        return "lucas";
      });
      await step.sleep("wait-10s", "10s");
      const lastName = await step.run("define-lastname", () => {
        return "fernandes";
      });
      return `Hello ${data.prefix} ${firstName} ${lastName}`;
    },
  );

  const initial = buildInstance("DefineFirstNameAndLastName", { prefix: "Mr" });
  const abortSignal = new AbortController().signal;
  await t.step("init define-firstname", async () => {
    const result = await fns.onHandler(initial, abortSignal);
    assertEquals(result, {
      completed: false,
      mutations: [
        {
          id: "define-firstname",
          type: "run",
          params: null,
          completed: false,
        },
      ],
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
          completed: false,
          result: undefined,
        },
      ],
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      completed: false,
      mutations: [
        {
          id: "define-firstname",
          completed: true,
          elapsed: 0,
          result: "lucas",
        },
      ],
    });
  });
  await t.step("define wait-10s", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "define-firstname",
          completed: true,
          result: "lucas",
          type: "run",
          params: null,
        },
      ],
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      completed: false,
      mutations: [
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          completed: false,
        },
      ],
    });
  });
  await t.step("wait wait-10s", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "define-firstname",
          completed: true,
          result: "lucas",
          type: "run",
          params: null,
        },
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          result: null,
          completed: false,
        },
      ],
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      completed: false,
      mutations: [],
    });
  });
  await t.step("define lastname", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "define-firstname",
          completed: true,
          result: "lucas",
          type: "run",
          params: null,
        },
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          result: null,
          completed: true,
        },
      ],
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      completed: false,
      mutations: [
        {
          completed: false,
          id: "define-lastname",
          params: null,
          type: "run",
        },
      ],
    });
  });
  await t.step("memo lastname", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "define-firstname",
          completed: true,
          result: "lucas",
          type: "run",
          params: null,
        },
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          result: null,
          completed: true,
        },
        {
          completed: true,
          id: "define-lastname",
          params: null,
          type: "run",
          result: "marie",
        },
      ],
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      completed: true,
      result: "Hello Mr lucas marie",
    });
  });
});
Deno.test("LockerToUnlock", async (t) => {
  const fns = new Fns({ dev: true });
  fns.createFunction(
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
  const initial = buildInstance("LockerToUnlock", { isLocked: true });
  const abortSignal = new AbortController().signal;
  await t.step("init condition", async () => {
    const result = await fns.onHandler(initial, abortSignal);
    assertEquals(result, {
      completed: false,
      mutations: [
        {
          id: "wait-unlock",
          params: null,
          type: "condition",
          completed: false,
        },
      ],
      queries: {
        isLocked: true,
      },
      state: {
        isLocked: true,
      },
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
          result: undefined,
          completed: false,
        },
        {
          id: "signal",
          type: "signal",
          params: { signal: "unlock" },
          result: undefined,
          completed: true,
        },
      ],
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      completed: false,
      mutations: [
        {
          id: "wait-unlock",
          result: true,
          elapsed: 0,
          completed: true,
        },
      ],
      queries: {
        isLocked: false,
      },
      state: {
        isLocked: false,
      },
    });
  });
  await t.step("completed", async () => {
    const params: FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "wait-unlock",
          type: "run",
          params: null,
          result: true,
          completed: true,
        },
        {
          id: "signal",
          type: "signal",
          params: { signal: "unlock" },
          result: undefined,
          completed: true,
        },
      ],
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      completed: true,
      result: "unlocked",
      queries: {
        isLocked: false,
      },
    });
  });
});
Deno.test("CorrectConstructEvent", async (t) => {
  const fns = new Fns({ token: "Hello world" });
  fns.createFunction({ name: "test", version: 1 }, () => async ({ step }) => {
    await step.sleep("wait-10s", "10s");
    return "End!";
  });
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
