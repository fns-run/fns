import { verify } from "./signature.ts";
import { ms } from "https://raw.githubusercontent.com/denolib/ms/d9e99a2fa10a9dc8d4cd97b8de1be10c57bf6e77/ms.ts";
import { NonRetriableError, FnsRequestParams, FnsResponse, FnsFunction, Schema, Mutation, StepType } from './types.ts';
import { block, execute } from "./helper.ts";
import { xxHash32 } from "./xxhash32.ts";

export const FNS_SIGNATURE_HEADER = "x-fns-signature";

interface Query {
  name: string;
  cb: () => any;
  dependencies: string[];
}
type Callback<T = any> = () => T;
interface StateGetter<T = any> extends Callback<T> { id: string; };
interface StartExecutionArgs {
  id: string;
  name: string;
  data: any;
}
interface TriggerExecutionArgs {
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
interface SignalExecutionResponse {
  ok: boolean;
  signal: { id: string; }
}

export interface FnsOptions {
  dev?: boolean;
  endpoint?: string;
  token?: string;
  apiKey?: string;
}
interface FnsDefinition {
  name: string;
  fn: FnsFunction;
  version: number;
  states: Record<string, any>;
  funcs: string[];
  queries: string[];
  signals: string[];
  schema: Schema;
}
export class Fns {
  private _definitions: FnsDefinition[];
  private _options: FnsOptions;
  private _ver: number;
  constructor(options: FnsOptions) {
    this._definitions = [];
    this._options = options;
    this._ver = 0;
  }
  private async POST<T = any>(endpoint: string, body: any, headers: Record<string, string> = {}): Promise<T> {
    if (!this._options.endpoint) throw new Error("Endpoint is required");
    const url = new URL(endpoint, this._options.endpoint);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Authorization: `ApiKey ${this._options.apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
    return await res.json() as T;
  }
  private async GET<T>(endpoint: string): Promise<T> {
    if (!this._options.endpoint) throw new Error("Endpoint is required");
    const url = new URL(endpoint, this._options.endpoint);
    const res = await fetch(url, {
      headers: {
        Authorization: `ApiKey ${this._options.apiKey}`
      }
    });
    if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
    return await res.json() as T;
  }
  async invoke(args: StartExecutionArgs) {
    const res = await this.POST<StartExecutionResponse>("/executions/create", args);
    return res;
  }
  async result<T>(id: string) {
    const res = await this.GET<T>(`/executions/${id}/result`);
    return res;
  }
  async trigger(args: TriggerExecutionArgs) {
    const res = await this.POST<SignalExecutionResponse>(`/executions/${args.id}/trigger`, { signal: args.signal, data: args.data }, args.idempotencyKey ? { "x-fns-idempotency-key": args.idempotencyKey } : {});
    return res;
  }
  async query<T>(args: QueryExecutionArgs) {
    const res = await this.GET<T>(`/executions/${args.id}/query/${args.query}`);
    return res;
  }
  constructEvent(body: string, signature: string) {
    if (!this._options.dev) {
      if (!this._options.token) throw new Error("Token is required");
      if (!verify(body, this._options.token, signature)) throw new Error("Invalid signature");
    }
    const event = JSON.parse(body);
    return event;
  }
  async onHandler(event: FnsRequestParams, abortSignal: AbortSignal): Promise<FnsResponse> {
    const workflow = this._definitions.find((w) => w.name === event.name);
    if (!workflow) throw new Error(`Function ${event.name} not found`);
    const output = await this.engine(event, workflow.fn, abortSignal);
    return output as FnsResponse;
  }
  private async engine(event: FnsRequestParams, fn: FnsFunction, abortSignal: AbortSignal): Promise<FnsResponse> {
    if (abortSignal.aborted) throw new Error("Aborted");
    let init = false;
    let pc = 0;
    const steps = event.steps; // before [...event.steps]
    const state: Record<string, any> = event.state ?? {};
    const stateChanges = new Set<string>();
    const mutations: Mutation[] = [];

    const signals = new Map<string, any>();
    const queries: Query[] = [];
    const mutexes = new Set<string>();

    function unrollSignals() {
      if (steps.length === 0) return;
      while (steps.at(pc)?.type === "signal") {
        const next = steps[pc++]
        if (!next) return;
        const { signal } = next.params as { signal: string };
        const cb = signals.get(signal);
        if (!cb) throw new NonRetriableError(`Signal ${signal} not found`);
        cb(next.result);
      }
    }
    async function memo(id: string, type: StepType, params: any, write: (done: (res: any) => void) => any | Promise<any> = () => {}, complete: (res: any) => void = () => {}) {
      if (!init) throw new NonRetriableError("must be initialized");
      const step = steps[pc++];
      unrollSignals();
      if (!step) { // initialize
        mutations.push({ id, type, params, completed: false });
        return await block();
      }
      if (step.id !== id) throw new NonRetriableError(`Invalid step id ${step.id} expected ${id}`);
      if (step.completed) { // completed
        complete(step.result);
        return step.result;
      }
      const start = performance.now();
      await Promise.resolve(write((result) => mutations.push({ id, result, elapsed: Math.round(performance.now() - start), completed: true })));
      return await block();
    }
    async function run<T = any>(id: string, cb: () => T | Promise<T>) {
      return await memo(id, "run", {}, async (done) => {
        const res = await Promise.resolve(cb());
        done(res)
      });
    }
    async function sleep(id: string, timeout: string | number) {
      return await memo(id, "sleep", { timeout: typeof timeout === 'string' ? ms(timeout) : timeout }, (done) => {});
    }
    async function sleepUntil(id: string, until: Date | string) {
      return await memo(id, "sleep", { until: typeof until === 'string' ? until : until.toISOString() }, () => {});
    }
    async function condition (id: string, cb: () => boolean, timeout?: string | number) {
      return await memo(id, "condition", { timeout: typeof timeout === 'string' ? ms(timeout) : timeout }, (done) => cb() && done(true));
    }
    async function lock(id: string, keys: string[], timeout?: string | number): Promise<boolean> {
      return await memo(id, "lock", { keys, timeout: typeof timeout === 'string' ? ms(timeout) : timeout }, () => {}, (res) => {
        if (res) {
          for (let i = 0; i < keys.length; i++) {
            mutexes.add(keys[i])
          }
        }
      });
    }
    async function unlock(id: string, keys?: string[]): Promise<void> {
      const cb = () => {
        if (!keys) {
          mutexes.clear();
          return;
        }
        for (let i = 0; i < keys.length; i++) mutexes.delete(keys[i]);
      }
      return await memo(id, "unlock", { keys }, () => {}, cb);
    }
    function useState<T = any>(id: string, initial?: T): [StateGetter<typeof initial>, (newState: typeof initial | ((prevState: typeof initial) => typeof initial)) => void] {
      if (init) throw new NonRetriableError("useState must be called at initialization");
      if (!(id in state)) {
        state[id] = initial;
        stateChanges.add(id);
      }
      function SetState(newState: (typeof initial | ((prevState: typeof initial) => typeof initial))) {
        state[id] = typeof newState === 'function' ? (newState as any)(state[id]) : newState;
        stateChanges.add(id);
      }
      function GetState() {
        return state[id] as typeof initial;
      }
      GetState.id = id;
      return [GetState, SetState];
    }
    function useSignal<T = any>(signal: string, cb?: (data: T) => void) {
      if (init) throw new NonRetriableError("useSignal must be called at initialization");
      if (signals.has(signal)) throw new NonRetriableError(`Signal ${signal} already in use`);
      //const [signalValue, setSignalState] = useState<T>();
      signals.set(signal, (value: T) => {
        //setSignalState(value);
        cb?.(value);
      });
      //if (signalValue() !== undefined) cb?.(signalValue()!);
      //return signalValue;
    }
    function useQuery<T = any>(query: string, cb: () => T, dependencies: StateGetter[] = []) {
      if (init) throw new NonRetriableError("useQuery must be called at initialization");
      if (!queries.find((q) => q.name === query)) {
        queries.push({ name: query, cb, dependencies: dependencies.map((dep) => dep.id) });
        return;
      }
      throw new NonRetriableError(`Query ${query} already in use`);
    }
    function useFunctions(names: string[]) {
      const interfaces = {} as Record<string, any>;
      for(let i = 0; i < names.length; i++) {
        const name = names[i];
        interfaces[name] = {
          get: async (id: string, options: { id: string }) => {
            return await memo(id, "get", { id: options.id }, () => {})
          },
          invoke: async (id: string, options: { id?: string; data: any }) => {
            return await memo(id, "invoke", { id: id ?? null, name, data: options.data }, () => {});
          },
          trigger: async (id: string, options: { id: string; signal: string; data: any }) => {
            return await memo(id, "trigger", { id, name, signal: options.signal, data: options.data }, () => {});
          },
          query: async (id: string, options: { id: string; query: string }) => {
            return await memo(id, "query", { id, name, query: options.query }, () => {});
          },
          result: async (id: string, options: { id: string; query: string }) => {
            return await memo(id, "query", { id, name, query: options.query }, () => {});
          }
        };
      }
      return interfaces;
    }
    const bootstrap = await fn({ useSignal, useQuery, useState, useFunctions });
    if (typeof bootstrap !== 'function') throw new NonRetriableError("must return a function");
    unrollSignals();
    init = true;
    let isCompleted, result;
    try {
      [isCompleted, result] = await execute(bootstrap({
        abortSignal,
        ctx: {
          id: event.id,
          run_id: event.run_id,
          data: event.data
        },
        step: {
          run,
          sleep,
          sleepUntil,
          condition,
          lock,
          unlock,
          checkpoint: function (): Promise<boolean> {
            throw new Error("Function not implemented.");
          }
        },
        logger: {
          info(...args: any[]) {
            console.log(...args);
          },
          warn(...args: any[]) {
            console.warn(...args);
          },
          error(...args: any[]) {
            console.error(...args);
          },
          debug(...args: any[]) {
            console.debug(...args);
          }
        }
      }));
    } catch (er: any) {
      let retryable = true;
      if (er instanceof NonRetriableError) retryable = false;
      return {
        completed: false,
        error: {
          message: er.message,
          stack: er.stack ?? "",
          name: er.name,
          retryable
        },
      }
    };
    const applyState = Object.fromEntries(Array.from(stateChanges).map((id) => [id, state[id]]))
    const applyQueries = Object.fromEntries(queries
      .filter((q) => q.dependencies.length == 0 || q.dependencies.some((dep) => stateChanges.has(dep)))
      .map((q) => [q.name, q.cb()]));

    if(isCompleted) {
      return {
        completed: true,
        result,
        ... Object.keys(applyQueries).length > 0 ? { queries: applyQueries } : {},
      }
    }
    return {
      completed: false,
      mutations,
      ... stateChanges.size > 0 ? { state: applyState } : {},
      ... Object.keys(applyQueries).length > 0 ? { queries: applyQueries } : {},
    }
  }
  public getConfig() {
    return {
      checksum: this._ver,
      definitions: this._definitions
    }
  }
  createFunction({name, version, schema}: { name: string, version: number, schema?: Schema }, fn: FnsFunction) {
    const states: Record<string, any> = {};
    const queries: Set<string> = new Set();
    const signals: Set<string> = new Set();
    const funcs: Set<string> = new Set();

    try {
      const output = fn({
        useQuery(name) {
          queries.add(name);
        },
        useSignal(name) {
          signals.add(name);
          return () => undefined;
        },
        useState(name: string, initial) {
          states[name] = initial;
          return [() => initial, () => {}];
        },
        useFunctions(names: string[]) {
          for (let i = 0; i < names.length; i++) {
            funcs.add(names[i]);
          }
          return {} as any;
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
      states,
      funcs: Array.from(funcs),
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