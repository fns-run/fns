import { verify } from "./signature.ts";
import { assert, assertExists, ms } from "../deps.ts";
import {
  FnsFunction,
  FnsRemoteFunction,
  FnsRequestParams,
  FnsResponse,
  Mutation,
  NonRetriableError,
  Params,
  Query,
  Schema,
  StateGetter,
  StepType,
} from "./types.ts";
import { block, execute } from "./helper.ts";
import { xxHash32 } from "./xxhash32.ts";

export const FNS_SIGNATURE_HEADER = "x-fns-signature";
interface StartExecutionArgs {
  id: string;
  name: string;
  data: unknown;
}
interface TriggerExecutionArgs {
  id: string;
  signal: string;
  data: unknown;
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
  signal: { id: string };
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
  states: Record<string, unknown>;
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
  /* TODO: Seperate to a client class */
  private async POST<T = unknown>(
    endpoint: string,
    body: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    if (!this._options.endpoint) throw new Error("Endpoint is required");
    const url = new URL(endpoint, this._options.endpoint);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Authorization: `ApiKey ${this._options.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
    return await res.json() as T;
  }
  private async GET<T>(endpoint: string): Promise<T> {
    if (!this._options.endpoint) throw new Error("Endpoint is required");
    const url = new URL(endpoint, this._options.endpoint);
    const res = await fetch(url, {
      headers: {
        Authorization: `ApiKey ${this._options.apiKey}`,
      },
    });
    if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
    return await res.json() as T;
  }
  async invoke(args: StartExecutionArgs) {
    const res = await this.POST<StartExecutionResponse>(
      "/executions/create",
      args,
    );
    return res;
  }
  async result<T>(id: string) {
    const res = await this.GET<T>(`/executions/${id}/result`);
    return res;
  }
  async trigger(args: TriggerExecutionArgs) {
    const res = await this.POST<SignalExecutionResponse>(
      `/executions/${args.id}/trigger`,
      { signal: args.signal, data: args.data },
      args.idempotencyKey
        ? { "x-fns-idempotency-key": args.idempotencyKey }
        : {},
    );
    return res;
  }
  async query<T>(args: QueryExecutionArgs) {
    const res = await this.GET<T>(`/executions/${args.id}/query/${args.query}`);
    return res;
  }
  constructEvent(body: string, signature: string) {
    if (!this._options.dev) {
      if (!this._options.token) throw new Error("Token is required");
      if (!verify(body, this._options.token, signature)) {
        throw new Error("Invalid signature");
      }
    }
    const event = JSON.parse(body);
    return event;
  }
  async onHandler(
    event: FnsRequestParams,
    abortSignal: AbortSignal,
  ): Promise<FnsResponse> {
    const workflow = this._definitions.find((w) => w.name === event.name);
    if (!workflow) throw new Error(`Function ${event.name} not found`);
    const output = await this.engine(event, workflow.fn, abortSignal);
    return output as FnsResponse;
  }
  private async engine(
    event: FnsRequestParams,
    fn: FnsFunction,
    abortSignal: AbortSignal,
  ): Promise<FnsResponse> {
    if (abortSignal.aborted) throw new Error("Aborted");
    let init = false;
    let pc = 0;
    const steps = event.steps;
    const state: Record<string, unknown> = event.state ?? {};
    const stateChanges = new Set<string>();
    const mutations: Mutation[] = [];

    const signals = new Map<string, (data: unknown) => void>();
    const queries: Query[] = [];
    const mutexes = new Set<string>();

    function unrollSignals() {
      if (steps.length === 0) return;
      while (steps.at(pc)?.type === "signal") {
        const next = steps[pc++];
        if (!next) return;
        assertExists(next.params, "params is required");
        const params = next.params as { signal: string };
        assertExists(params.signal, "signal is required");
        const cb = signals.get(params.signal);
        assertExists(cb, `Signal ${params.signal} not found`);
        cb(next.result);
      }
    }
    async function memo<T = unknown>(
      id: string,
      type: StepType,
      params: Params,
      write: (done: (res: unknown) => void) => unknown | Promise<unknown> =
        () => {},
      complete: (res: unknown) => void = () => {},
    ): Promise<T> {
      assertExists(id, "id is required");
      assertExists(type, "type is required");
      assertExists(write, "write callback is required");
      assertExists(complete, "complete callback is required");
      assert(
        params === null || params instanceof Object,
        "params must be null or an object",
      );
      assert(write instanceof Function, "write must be a function");
      assert(complete instanceof Function, "complete must be a function");
      assert(init, "memo must be called at initialization");
      const step = steps[pc++];
      unrollSignals();
      if (!step) { // initialize
        mutations.push({ id, type, params, completed: false });
        return await block<T>();
      }
      assert(step.id === id, `Invalid step id ${step.id} expected ${id}`);
      if (step.completed) {
        complete(step.result);
        return step.result as T;
      }
      const start = performance.now();
      await Promise.resolve(
        write((result) =>
          mutations.push({
            id,
            result,
            elapsed: Math.round(performance.now() - start),
            completed: true,
          })
        ),
      );
      return await block<T>();
    }
    async function run<T = unknown>(
      id: string,
      cb: () => T | Promise<T>,
    ): Promise<T> {
      assertExists(id, "id is required");
      assertExists(cb, "cb is required");
      assert(typeof cb === "function", "cb must be a function");
      return await memo<T>(id, "run", null, async (done) => {
        const res = await Promise.resolve(cb());
        done(res);
      });
    }
    async function sleep(id: string, timeout: string | number): Promise<void> {
      assertExists(id, "id is required");
      assertExists(timeout, "timeout is required");
      assert(
        typeof timeout === "string" || typeof timeout === "number",
        "timeout must be a string or number",
      );
      return await memo<void>(id, "sleep", {
        timeout: typeof timeout === "string" ? ms(timeout) as number : timeout,
      }, () => {});
    }
    async function sleepUntil(id: string, until: Date | string): Promise<void> {
      assertExists(id, "id is required");
      assertExists(until, "until is required");
      assert(
        (until as unknown) instanceof Date || typeof until === "string",
        "until must be a string or date",
      );
      return await memo<void>(id, "sleep", {
        until: typeof until === "string" ? until : until.toISOString(),
      }, () => {});
    }
    async function condition(
      id: string,
      cb: () => boolean,
      timeout?: string | number,
    ): Promise<boolean> {
      assertExists(id, "id is required");
      assertExists(cb, "cb is required");
      assert(typeof cb === "function", "cb must be a function");
      assert(
        typeof timeout === "string" || typeof timeout === "number" ||
          timeout === undefined,
        "timeout must be a string, number or undefined",
      );
      return await memo<boolean>(
        id,
        "condition",
        timeout
          ? {
            timeout: typeof timeout === "string"
              ? ms(timeout) as number
              : timeout,
          }
          : null,
        (done) => cb() && done(true),
      );
    }
    async function lock(
      id: string,
      keys: string[],
      timeout?: string | number,
    ): Promise<boolean> {
      assertExists(id, "id is required");
      assertExists(keys, "keys is required");
      assert(keys instanceof Array, "keys must be an array");
      assert(keys.length > 0, "keys must not be empty");
      assert(
        typeof timeout === "string" || typeof timeout === "number" ||
          timeout === undefined,
        "timeout must be a string, number or undefined",
      );
      return await memo<boolean>(
        id,
        "lock",
        {
          keys,
          ...timeout
            ? { timeout: typeof timeout === "string" ? ms(timeout) : timeout }
            : {},
        },
        () => {},
        (res) => {
          if (res) {
            for (let i = 0; i < keys.length; i++) {
              mutexes.add(keys[i]);
            }
          }
        },
      );
    }
    async function unlock(id: string, keys?: string[]): Promise<void> {
      assertExists(id, "id is required");
      assert(
        keys === undefined || (keys instanceof Array && keys.length > 0),
        "keys must be an array not empty or undefined",
      );
      const cb = () => {
        if (!keys) {
          mutexes.clear();
          return;
        }
        for (let i = 0; i < keys.length; i++) mutexes.delete(keys[i]);
      };
      return await memo<void>(
        id,
        "unlock",
        keys ? { keys } : null,
        () => {},
        cb,
      );
    }
    function useState<T = unknown>(
      id: string,
      initial?: T,
    ): [
      StateGetter<typeof initial>,
      (
        newState:
          | typeof initial
          | ((prevState: typeof initial) => typeof initial),
      ) => void,
    ] {
      assertExists(id, "id is required");
      assert(typeof id === "string", "id must be a string");
      assert(!init, "useState must be called at initialization");
      if (!(id in state)) {
        state[id] = initial;
        stateChanges.add(id);
      }
      function SetState(
        newState:
          | typeof initial
          | ((prevState: typeof initial) => typeof initial),
      ) {
        state[id] = typeof newState === "function"
          ? (newState as (previous: T) => T)(state[id] as T)
          : newState;
        stateChanges.add(id);
      }
      function GetState() {
        return state[id] as typeof initial;
      }
      GetState.id = id;
      return [GetState, SetState];
    }
    function useSignal<T = unknown>(signal: string, cb: (data: T) => void) {
      assertExists(signal, "signal is required");
      assertExists(cb, "cb is required");
      assert(typeof signal === "string", "signal must be a string");
      assert(typeof cb === "function", "cb must be a function");
      assert(!init, "useSignal must be called at initialization");
      assert(!signals.has(signal), `Signal ${signal} already in use`);
      signals.set(signal, (value) => cb?.(value as T));
    }
    function useQuery<T = unknown>(
      query: string,
      cb: () => T,
      dependencies: StateGetter[] = [],
    ) {
      assertExists(query, "query is required");
      assertExists(cb, "cb is required");
      assertExists(dependencies, "dependencies is required");
      assert(typeof query === "string", "query must be a string");
      assert(typeof cb === "function", "cb must be a function");
      assert(dependencies instanceof Array, "dependencies must be an array");
      assert(!init, "useQuery must be called at initialization");
      assert(
        !queries.find((q) => q.name === query),
        `Query ${query} already in use`,
      );
      queries.push({
        name: query,
        cb,
        dependencies: dependencies.map((dep) => dep.id),
      });
    }
    function useFunctions(_names: string[]): Record<string, FnsRemoteFunction> {
      throw new NonRetriableError("useFunctions not implemented");
      /*
      const interfaces = {};
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        interfaces[name] = {
          get: async (id: string, options: { id: string }) => {
            return await memo(id, "get", { id: options.id }, () => {});
          },
          invoke: async (id: string, options: { id?: string; data?: unknown }) => {
            return await memo(id, "invoke", {
              id: options.id ?? null,
              name,
              data: options.data,
            }, () => {});
          },
          trigger: async (
            id: string,
            options: { id: string; signal: string; data?: unknown },
          ) => {
            return await memo(id, "trigger", {
              id,
              name,
              signal: options.signal,
              data: options.data,
            }, () => {});
          },
          query: async (id: string, options: { id: string; query: string }) => {
            return await memo(
              id,
              "query",
              { id, name, query: options.query },
              () => {},
            );
          },
          result: async (
            id: string,
            options: { id: string; query: string },
          ) => {
            return await memo(
              id,
              "query",
              { id, name, query: options.query },
              () => {},
            );
          },
        };
      }
      return interfaces;
      */
    }
    const bootstrap = await fn({ useSignal, useQuery, useState, useFunctions });
    assertExists(bootstrap, "must return a function");
    assert(typeof bootstrap === "function", "must return a function");
    unrollSignals();
    init = true;
    let isCompleted, result;
    try {
      [isCompleted, result] = await execute(bootstrap({
        abortSignal,
        ctx: {
          id: event.id,
          run_id: event.run_id,
          data: event.data,
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
          },
        },
        logger: {
          info(...args: unknown[]) {
            console.log(...args);
          },
          warn(...args: unknown[]) {
            console.warn(...args);
          },
          error(...args: unknown[]) {
            console.error(...args);
          },
          debug(...args: unknown[]) {
            console.debug(...args);
          },
        },
      }));
    } catch (e) {
      let retryable = true;
      if (e instanceof NonRetriableError) retryable = false;
      return {
        completed: false,
        error: {
          message: e.message,
          stack: e.stack ?? "",
          name: e.name,
          retryable,
        },
      };
    }
    const applyState = Object.fromEntries(
      Array.from(stateChanges).map((id) => [id, state[id]]),
    );
    const applyQueries = Object.fromEntries(
      queries
        .filter((q) =>
          q.dependencies.length == 0 ||
          q.dependencies.some((dep) => stateChanges.has(dep))
        )
        .map((q) => [q.name, q.cb()]),
    );

    if (isCompleted) {
      return {
        completed: true,
        result,
        ...Object.keys(applyQueries).length > 0
          ? { queries: applyQueries }
          : {},
      };
    }
    return {
      completed: false,
      mutations,
      ...stateChanges.size > 0 ? { state: applyState } : {},
      ...Object.keys(applyQueries).length > 0 ? { queries: applyQueries } : {},
    };
  }
  public getConfig() {
    return {
      checksum: this._ver,
      definitions: this._definitions,
    };
  }
  createFunction(
    { name, version, schema }: {
      name: string;
      version: number;
      schema?: Schema;
    },
    fn: FnsFunction,
  ) {
    const states: Record<string, unknown> = {};
    const queries: Set<string> = new Set();
    const signals: Set<string> = new Set();
    const funcs: Set<string> = new Set();

    try {
      // fake interface to collect all informations
      const output = fn({
        useQuery(name) {
          queries.add(name);
        },
        useSignal(name) {
          signals.add(name);
        },
        useState(name: string, initial) {
          states[name] = initial;
          return [() => initial, () => {}];
        },
        useFunctions(names: string[]) {
          for (let i = 0; i < names.length; i++) {
            funcs.add(names[i]);
          }
          return {};
        },
      });
      assertExists(output, "must return a function");
      assert(typeof output === "function", "must return a function");
    } catch (e) {
      throw new Error(
        `Failed to create function ${name}:${version} with message: ${e.message}`,
      );
    }
    this._definitions.push({
      name,
      version,
      fn,
      states,
      funcs: Array.from(funcs),
      queries: Array.from(queries),
      signals: Array.from(signals),
      schema: schema ?? {},
    });
    this._ver = xxHash32(
      this._definitions
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((w) => (`${w.name}:${w.version}`))
        .join(";"),
    );
  }
}
export default { Fns };
