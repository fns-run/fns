// url_test.ts
import { assert, assertEquals } from "../deps.ts";
import { Fns } from "./index.ts";
import { FnsRequestParams } from "./types.ts";

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

const fns = new Fns({ dev: false, token: "test" });

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

fns.createFunction(
  { name: "LockerToUnlock", version: 1 },
  ({ useSignal }) => {
    let locked: boolean = true;
    useSignal("unlock", () => locked = false);
    return async ({ step, ctx }) => {
      const data = ctx.data as { isLocked: boolean };
      if (data && data.isLocked !== undefined) {
        locked = data.isLocked;
      }
      await step.condition("wait-unlock", () => locked === false);
      return "unlocked";
    };
  },
);

Deno.test("DefineFirstNameAndLastName", async (t) => {
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
    });
  });
});
