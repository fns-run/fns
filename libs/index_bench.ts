import { Fns } from "../mod.ts";
import type { FnsRequestParams } from "./types.ts";
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
const abortSignal = new AbortController().signal;

const fns = new Fns({ baseUrl: "http://localhost:3100" });
const defineWorkflow = fns.createFunction(
  { name: "DefineFirstNameAndLastName", version: 1 },
  () => async ({ step, ctx }) => {
    const data = ctx.data as { prefix: string };
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
fns.registerFunctions([defineWorkflow]);
const initial = buildInstance("DefineFirstNameAndLastName", { prefix: "Mr" });
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

Deno.bench("onHandler", async () => {
  await fns.onHandler(params, abortSignal);
});
