// url_test.ts
import { assertEquals } from "jsr:@std/assert@^0.225.3";
import { Fns } from "./index.ts";
import { FnsRequestParams } from "./types.ts";


const fns = new Fns({ dev: true, token: "test" });

fns.createFunction({ name: "SimpleSequentialWorkflow", version: 1 }, () => async ({ step }) => {
  const firstName = await step.run("define-firstname", () => {
    return "lucas";
  });
  await step.sleep("wait-10s", "10s");
  const lastName = await step.run("define-lastname", () => {
    return "fernandes";
  });
  return `Hello ${firstName} ${lastName}`;
});

Deno.test("Simple sequential workflow", async (t) => {
  const initial: FnsRequestParams = {
    id: "test_id",
    run_id: "test_run_id",
    name: "SimpleSequentialWorkflow",
    data: {},
    steps: [],
    state: {},
    snapshot: false
  };
  const abortSignal = new AbortController().signal;
  await t.step("init define-firstname", async () => {
    const result = await fns.onHandler(initial, abortSignal);
    assertEquals(result, {
      completed: false,
      mutations: [
        {
          id: "define-firstname",
          type: "run",
          params: {} as any,
          completed: false
        }
      ]
    });
  });
  await t.step("memo define-firstname", async () => {
    const params:  FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "define-firstname",
          type: "run",
          params: {} as any,
          completed: false,
          result: undefined
        }
      ]
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      completed: false,
      mutations: [
        {
          id: "define-firstname",
          completed: true,
          elapsed: 0,
          result: "lucas"
        }
      ]
    });
  });
  await t.step("define wait-10s", async () => {
    const params:  FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "define-firstname",
          completed: true,
          result: "lucas",
          type: "run",
          params: {} as any
        }
      ]
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      completed: false,
      mutations: [
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          completed: false
        }
      ]
    });
    /*initial.steps.push({
      completed: false,
      id: "wait-10s",
      type: "sleep",
      params: { timeout: 10000 },
      result: undefined
    })*/
  });
  await t.step("wait wait-10s", async () => {
    const params:  FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "define-firstname",
          completed: true,
          result: "lucas",
          type: "run",
          params: {} as any
        },
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          result: null,
          completed: false
        }
      ]
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      completed: false,
      mutations: []
    });
  });
  await t.step("define lastname", async () => {
    const params:  FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "define-firstname",
          completed: true,
          result: "lucas",
          type: "run",
          params: {} as any
        },
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          result: null,
          completed: true
        }
      ]
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      completed: false,
      mutations: [
        {
          completed: false,
          id: "define-lastname",
          params: {} as any,
          type: "run",
        },
      ],
    });
  });
  await t.step("memo lastname", async () => {
    const params:  FnsRequestParams = {
      ...initial,
      steps: [
        {
          id: "define-firstname",
          completed: true,
          result: "lucas",
          type: "run",
          params: {} as any
        },
        {
          id: "wait-10s",
          type: "sleep",
          params: { timeout: 10000 },
          result: null,
          completed: true
        },
        {
          completed: true,
          id: "define-lastname",
          params: {} as any,
          type: "run",
          result: "marie"
        },
      ]
    };
    const result = await fns.onHandler(params, abortSignal);
    assertEquals(result, {
      completed: true,
      result: "Hello lucas marie"
    });
  });
});