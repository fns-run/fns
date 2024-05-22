import { verify } from "./signature";
import ms from 'ms';
import { NonRetriableError, Op, HandlerParams, HandlerResponse, WorkflowFunction, Schema } from './types';
import { block, execute } from "./helper";
import { xxHash32 } from "./xxhash32";

export const FNS_SIGNATURE_HEADER = "X-Fns-Signature";
export const FNS_API_KEY_HEADER = "X-Fns-Api-Key";

interface Query {
  name: string;
  cb: () => any;
  dependencies: number[];
}

type Callback<T = any> = () => T;
interface StateGetter<T = any> extends Callback<T> { id: number; };
interface StartExecutionArgs {
  id: string;
  name: string;
  data: any;
}
interface SignalExecutionArgs {
  id: string;
  signal: string;
  data: any;
  idempotencyKey?: string;
}
interface QueryExecutionArgs {
  id: string;
  query: string;
}
interface StartExecutionResponse {
  ok: boolean;
}
export class Fns {
  private _prod_api = "https://api.fns.run";
  private _dev_api = "http://localhost:3200";
  private _options: FnsOptions;
  constructor(options: FnsOptions) {
    this._options = options;
  }
  private async POST<T>(endpoint: string, body: any, headers: Record<string, string> = {}): Promise<T> {
    const url = new URL(endpoint, this._options.dev ? this._dev_api : this._prod_api);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        [FNS_API_KEY_HEADER]: this._options.apiKey
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
    return await res.json() as T;
  }
  private async GET<T>(endpoint: string): Promise<T> {
    const url = new URL(endpoint, this._options.dev ? this._dev_api : this._prod_api);
    const res = await fetch(url, {
      headers: {
        [FNS_API_KEY_HEADER]: this._options.apiKey
      }
    });
    if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
    return await res.json() as T;
  }

  async startExecution(args: StartExecutionArgs){
    const res = await this.POST<StartExecutionResponse>("/executions/create", args);
    return res;
  }
  async resultExecution(id: string) {
    const res = await this.GET<HandlerResponse>(`/executions/${id}/result`);
    return res;
  }
  async getExecution(id: string) {
    const res = await this.GET<HandlerResponse>(`/executions/${id}`);
    return res;
  }

  async signalExecution(args: SignalExecutionArgs) {
    const res = await this.POST<StartExecutionResponse>(`/executions/${args.id}/signal`, { signal: args.signal, data: args.data }, args.idempotencyKey ? { "Fns-Idempotency-Key": args.idempotencyKey } : {});
    return res;
  }

  async queryExecution(args: QueryExecutionArgs) {
    const res = await this.GET<any>(`/executions/${args.id}/query/${args.query}`);
    return res;
  }
}
export interface FnsOptions {
  dev?: boolean;
  apiKey: string;
}
export interface FnsRuntimeOptions {
  dev?: boolean;
  token: string;
}
interface FnsRuntimeDefinition {
  name: string;
  fn: WorkflowFunction;
  version: number;
  queries: string[];
  signals: string[];
  schema: Schema;
}
export class FnsRuntime {
  private _definitions: FnsRuntimeDefinition[];
  private _options: FnsRuntimeOptions;
  private _ver: number;
  constructor(options: FnsRuntimeOptions) {
    this._definitions = [];
    this._options = options;
    this._ver = 0;
  }
  constructEvent(body: string, signature: string) {
    if (!this._options.token) throw new Error("Token is required");
    if (!verify(body, this._options.token, signature)) throw new Error("Invalid signature");
    const event = JSON.parse(body);
    return event;
  }
  async onHandler(event: HandlerParams, abortSignal: AbortSignal): Promise<HandlerResponse> {
    const workflow = this._definitions.find((w) => w.name === event.name);
    if (!workflow) throw new Error(`Workflow ${event.name} not found`);
    const output = await this.engine(event, workflow.fn, abortSignal);
    return output as HandlerResponse;
  }
  private async engine(event: HandlerParams, fn: WorkflowFunction, abortSignal: AbortSignal): Promise<HandlerResponse> {
    if (abortSignal.aborted) throw new Error("Aborted");
    let stateId = 0;
    let init = false;
    const commitedOps: Op[] = event.ops ?? [];
    const state: any[] = event.state ?? [];
    const stateChanges = new Set<number>();
    const writes: Op[] = [];

    const signals = new Map<string, any>();
    const queries: Query[] = [];
    const mutexes = new Set<string>();

    function unrollSignals() {
      if (commitedOps.length === 0) return;
      while (commitedOps.at(0)?.type === "signal") {
        const next = commitedOps.shift();
        if (!next) return;
        const cb = signals.get(next.params!.name);
        if (!cb) throw new NonRetriableError(`Signal ${next.params!.name} not found`);
        cb(next.result);
      }
    }
    async function memo(type: "run" | "sleep" | "condition" | "signal" | "lock" | "unlock", params: any, write: (op: Op, done: (res: any) => void) => any | Promise<any> = () => {}, complete: (res: any) => void = () => {}) {
      if (!init) throw new NonRetriableError("Workflow must be initialized");
      const op = commitedOps.shift();
      unrollSignals();
      if (!op) {
        writes.push({ status: "initialized", type, params });
        return await block();
      }
      if (op.status === 'completed') {
        complete(op.result);
        return op.result;
      }
      if (op.status === 'pending') {
        const start = performance.now();
        await Promise.resolve(write(op, (result) => writes.push({ status: "completed", id: op.id, result, executionTime: Math.round(performance.now() - start) })));
      }
      return await block();
    }
    async function run<T = any>(name: string, cb: () => T | Promise<T>) {
      return await memo("run", { name }, async (_, done) => {
        const res = await Promise.resolve(cb());
        done(res)
      });
    }
    async function sleep (name: string, timeout: string | number) {
      return await memo("sleep", { name, timeout: typeof timeout === 'string' ? ms(timeout) : timeout }, (op, done) => {});
    }
    async function sleepUntil(name: string, until: Date | string) {
      return await memo("sleep", { name, until: typeof until === 'string' ? until : until.toISOString() }, () => {});
    }
    async function condition (name: string, cb: () => boolean, timeout?: string | number) {
      return await memo("condition", { name, timeout: typeof timeout === 'string' ? ms(timeout) : timeout }, (_, done) => cb() && done(true));
    }
    async function lock(name: string, keys: string[], timeout?: string | number): Promise<boolean> {
      return await memo("lock", { name, keys, timeout: typeof timeout === 'string' ? ms(timeout) : timeout }, () => {}, (res) => {
        if (res) keys.forEach((key) => mutexes.add(key));
      });
    }
    async function unlock(name: string, keys?: string[]): Promise<void> {
      return await memo("unlock", { name, keys }, () => {}, () => keys ? keys.forEach((key) => mutexes.delete(key)) : mutexes.clear());
    }
    const params = {
      useSignal<T = any>(signal: string, cb?: (data: T) => void) {
        let latestValue: T = undefined as any;
        if (init) throw new NonRetriableError("useSignal must be called at initialization");
        if (!signals.has(signal)) {
          signals.set(signal, (value: T) => {
            latestValue = value;
            cb?.(value);
          });
          unrollSignals();
          return () => latestValue;
        }
        throw new NonRetriableError(`Signal ${signal} already in use`);
      },
      useQuery<T = any>(query: string, cb: () => T, dependencies: StateGetter[] = []) {
        if (init) throw new NonRetriableError("useQuery must be called at initialization");
        if (!queries.find((q) => q.name === query)) {
          queries.push({ name: query, cb, dependencies: dependencies.map((dep) => dep.id) });
          return;
        }
        throw new NonRetriableError(`Query ${query} already in use`);
      },
      useState<T = any>(initial: T): [StateGetter<typeof initial>, (newState: typeof initial | ((prevState: typeof initial) => typeof initial)) => void] {
        if (init) throw new NonRetriableError("useState must be called at initialization");
        let myStoreId = stateId++;
        if (state.length === 0 || state.length <= myStoreId) {
          state[myStoreId] = initial;
          stateChanges.add(myStoreId);
        }
        function SetState(newState: (T | ((prevState: T) => T))) {
          state[myStoreId] = typeof newState === 'function' ? (newState as any)(state[myStoreId]) : newState;
          stateChanges.add(myStoreId);
        }
        function GetState() {
          return state[myStoreId];
        }
        GetState.id = myStoreId;
        return [GetState, SetState];
      }
    };
    const bootstrap = await fn(params);
    if (typeof bootstrap !== 'function') throw new NonRetriableError("Workflow must return a function");
    init = true;
    try {
      const [isCompleted, result] = await execute(bootstrap({
        abortSignal,
        event,
        step: {
          run,
          sleep,
          sleepUntil,
          condition,
          lock,
          unlock
        },
      }));
      const applyState = event.snapshot ? Object.fromEntries(Array.from(stateChanges).map((id) => [id, state[id]])) : null;
      const applyQueries = Object.fromEntries(queries.filter((q) => q.dependencies.length == 0 || q.dependencies.some((dep) => stateChanges.has(dep))).map((q) => [q.name, q.cb()]));
      if(isCompleted) return {
        ops: writes,
        status: "completed",
        result: result,
        queries: applyQueries,
        ... applyState && { state: applyState }
      }
      return {
        ops: writes,
        status: "incomplete",
        queries: applyQueries,
        state: applyState!
      }
    } catch (er: any) {
      let retryable = true;
      if (er instanceof NonRetriableError) retryable = false;
      return {
        ops: [],
        status: "error",
        error: {
          message: er.message,
          stack: er.stack ?? "",
          name: er.name,
          retryable
        }
      }
    }
  }
  public getConfig() {
    return {
      checksum: this._ver,
      definitions: this._definitions.map(({name, version, schema }) => ({ name, version, schema }))
    }
  }
  createFunction({name, version, schema}: { name: string, version: number, schema?: Schema }, fn: WorkflowFunction) {
    const queries: Set<string> = new Set();
    const signals: Set<string> = new Set();

    try {
      const output = fn({
        useQuery(name, cb, dependencies) {
          queries.add(name);
        },
        useSignal(name, cb) {
          signals.add(name);
        },
        useState: function <T = any>(initial: T): [() => T, (newState: T | ((prevState: T) => T)) => void] {
          return [() => initial, () => {}];
        }
      })
      if (typeof output !== 'function') throw new Error("Function must return a function");
    } catch (err) {
      throw new Error(`Failed to create function ${name}:${version}`);
    }
    this._definitions.push({
      name,
      version,
      fn,
      queries: Array.from(queries),
      signals: Array.from(signals),
      schema: schema ?? {}
    });
    this._ver = xxHash32(
      this._definitions
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((w) => (`${w.name}:${w.version}`))
        .join(";")
    );
  }
}
export default { Fns };