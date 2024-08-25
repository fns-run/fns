import { assert, assertExists } from "../deps.ts";
import { ms } from "./ms.ts";
import { verify } from "./signature.ts";
import type {
  FnsFunction,
  FnsLog,
  FnsOptions,
  FnsRequestParams,
  FnsResponse,
  Mutation,
  Params,
  Query,
  Schema,
  StateGetter,
  StepType,
} from "./types.ts";
import { block } from "./helper.ts";
import { xxHash32 } from "./xxhash32.ts";
import {
  InvalidSignatureError,
  NonRetriableError,
  SignatureVerificationError,
  SigningKeyRequiredError,
} from "./errors.ts";
import { safeDestr } from "./destr.ts";
import { ExecutionsClient } from "./clients/executions.ts";
import type { FnsConfig } from "./clients/client.ts";
import { QueriesClient } from "./clients/queries.ts";
import { StepsClient } from "./clients/steps.ts";
import { RunsClient } from "./clients/runs.ts";
import { ErrorsClient } from "./clients/errors.ts";

let performanceCounter: () => number = () => performance.now();
export function setPerformanceCounter(cb: () => number): void {
  performanceCounter = cb;
}

export const FNS_SIGNATURE_HEADER = "x-fns-signature";

interface FnsExternalConfig {
  checksum: number;
  definitions: Map<string, FnsDefinition>;
}

export type FnsDefinition = {
  name: string;
  fn: FnsFunction;
  version: number;
  states: Record<string, unknown>;
  remotes: string[];
  queries: string[];
  signals: string[];
  schema: Schema;
};
export class Fns {
  private config: FnsOptions;
  private definitions: Map<string, FnsDefinition> = new Map();
  private version: number = 0;
  executions: ExecutionsClient;
  queries: QueriesClient;
  steps: StepsClient;
  runs: RunsClient;
  errors: ErrorsClient;
  constructor(config: FnsConfig) {
    this.config = config;
    this.executions = new ExecutionsClient(config);
    this.queries = new QueriesClient(config);
    this.steps = new StepsClient(config);
    this.runs = new RunsClient(config);
    this.errors = new ErrorsClient(config);
  }
  async constructEvent(
    body: string,
    signature: string,
  ): Promise<FnsRequestParams> {
    const event: FnsRequestParams = safeDestr<FnsRequestParams>(body);
    if (this.config.dev) return event;
    if (!this.config.signingKey) throw new SigningKeyRequiredError();
    let isVerified: boolean = false;
    try {
      isVerified = await verify(body, this.config.signingKey, signature);
    } catch (err) {
      throw new SignatureVerificationError(err.message);
    }
    if (!isVerified) throw new InvalidSignatureError();
    return event;
  }
  async onHandler(
    event: FnsRequestParams,
    abortSignal: AbortSignal,
  ): Promise<FnsResponse> {
    const definition = this.definitions.get(event.name);
    if (!definition) throw new Error(`Function ${event.name} not found`);
    /*if (definition.version !== event.version) {
      throw new Error(
        `Function ${event.name} version ${definition.version} mismatch with request version ${event.version}`,
      );
    }*/
    const output = await this.engine(event, definition.fn, abortSignal);
    return output as FnsResponse;
  }
  private async engine(
    event: FnsRequestParams,
    fn: FnsFunction,
    abortSignal: AbortSignal,
  ): Promise<FnsResponse> {
    if (abortSignal.aborted) throw new Error("Aborted");
    let init = false;
    let tick = 0;
    let nPending = 0;
    const logs: Array<FnsLog> = [];

    const steps = event.steps;
    const state: Record<string, unknown> = event.state ?? {};
    const stateChanges = new Set<string>();
    const mutations: Mutation[] = [];

    const signals = new Map<string, (data: unknown) => void>();
    const queries: Query[] = [];
    const mutexes = new Set<string>();

    const isReplay = () => steps.length > tick;

    const appendLog = (level: FnsLog["level"], message: string[]) => {
      if (isReplay()) return;
      assert(
        level === "info" || level === "warn" || level === "error" ||
          level === "debug",
        "Invalid log level",
      );
      const maxLength = 2 * 1024;
      let finalMessage = message.join(" ");
      finalMessage = finalMessage.length > maxLength
        ? finalMessage.substring(0, maxLength - 3) + "..."
        : finalMessage;

      logs.push({
        level,
        message: finalMessage,
      });
      if (logs.length > 100) {
        logs.shift();
        if (this.config.dev) console.warn("Logs limit reached, dropping logs");
      }
      if (this.config.dev) {
        switch (level) {
          case "info":
            console.info(...message);
            break;
          case "warn":
            console.warn(...message);
            break;
          case "error":
            console.error(...message);
            break;
          case "debug":
            console.debug(...message);
            break;
        }
      }
    };
    function unrollSignals() {
      while (steps[tick]?.type === "signal") {
        const next = steps[tick++];
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
      const step = steps[tick++];
      unrollSignals();
      if (!step) {
        mutations.push({ id, type, params, status: "pending" });
        return block<T>();
      }
      assert(step.id === id, `Invalid step id ${step.id} expected ${id}`);
      if (step.status === "completed") {
        complete(step.result);
        return step.result as T;
      }
      const start = performanceCounter();
      let isSetted = false;
      let retn: T = null!;
      nPending++;
      await Promise.resolve(write((result) => {
        mutations.push({
          id,
          result,
          elapsed: Math.round(performanceCounter() - start),
          status: "completed",
        });
        retn = result as T;
        isSetted = true;
      })).finally(() => {
        nPending--;
      });
      if (!isSetted) return block<T>();
      complete(retn);
      return retn as T;
    }
    function run<T = unknown>(
      id: string,
      cb: () => T | Promise<T>,
    ): Promise<T> {
      assertExists(id, "id is required");
      assertExists(cb, "cb is required");
      assert(typeof cb === "function", "cb must be a function");
      return memo<T>(id, "run", null, async (done) => {
        const res = await cb();
        done(res);
      });
    }
    function sleep(id: string, timeout: string | number): Promise<void> {
      assertExists(id, "id is required");
      assertExists(timeout, "timeout is required");
      assert(
        typeof timeout === "string" || typeof timeout === "number",
        "timeout must be a string or number",
      );
      const params: Params = {
        timeout: typeof timeout === "string" ? ms(timeout) as number : timeout,
      };
      return memo<void>(id, "sleep", params, () => {});
    }
    function sleepUntil(id: string, until: Date | string): Promise<void> {
      assertExists(id, "id is required");
      assertExists(until, "until is required");
      assert(
        (until as unknown) instanceof Date || typeof until === "string",
        "until must be a string or date",
      );
      const params: Params = {
        until: typeof until === "string" ? until : until.toISOString(),
      };
      return memo<void>(id, "sleep", params, () => {});
    }
    function condition(
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
      const params: Params = timeout
        ? {
          timeout: typeof timeout === "string"
            ? ms(timeout) as number
            : timeout,
        }
        : null;
      return memo<boolean>(
        id,
        "condition",
        params,
        (write) => cb() && write(true),
      );
    }
    function lock(
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
      const params: Params = {
        keys,
        ...timeout
          ? { timeout: typeof timeout === "string" ? ms(timeout) : timeout }
          : {},
      };
      return memo<boolean>(
        id,
        "lock",
        params,
        () => {},
        (res) => {
          if (!res) return;
          for (let i = 0; i < keys.length; i++) {
            mutexes.add(keys[i]);
          }
        },
      );
    }
    function unlock(id: string, keys?: string[]): Promise<void> {
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
      const params: Params = keys ? { keys } : null;
      return memo<void>(
        id,
        "unlock",
        params,
        () => {},
        cb,
      );
    }
    async function* repeat(
      id: string,
      cron: { every: string | number; times?: number },
    ): AsyncGenerator<number, void, unknown> {
      assertExists(id, "id is required");
      assertExists(cron, "cron is required");
      assert(typeof id === "string", "id must be a string");
      assert(
        typeof cron === "object" && cron !== null,
        "cron must be an object",
      );
      let count = 1;
      const times = (cron.times === undefined || isNaN(cron.times))
        ? Infinity
        : cron.times;
      while (true) {
        const curr = count++;
        yield curr;
        if (curr >= times) break;
        await sleep(`${id}-${curr}`, cron.every);
      }
    }
    function useState<T = unknown>(
      id: string,
      initial: T,
    ): [
      StateGetter<T>,
      (
        newState:
          | T
          | ((prevState: T) => T),
      ) => void,
    ] {
      assertExists(id, "id is required");
      assert(typeof id === "string", "id must be a string");
      assert(!init, "useState must be called at initialization");
      if (!(id in state)) SetState(initial);
      function SetState(
        newState:
          | T
          | ((prevState: T) => T),
      ) {
        if (isReplay()) return;
        state[id] = typeof newState === "function"
          ? (newState as (previous: T) => T)(state[id] as T)
          : newState;
        stateChanges.add(id);
      }
      function GetState() {
        return state[id] as T;
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
    ) {
      assertExists(query, "query is required");
      assertExists(cb, "cb is required");
      assert(typeof query === "string", "query must be a string");
      assert(typeof cb === "function", "cb must be a function");
      assert(!init, "useQuery must be called at initialization");
      assert(
        !queries.find((q) => q.name === query),
        `Query ${query} already in use`,
      );
      const row: Query = {
        name: query,
        cb,
      };
      queries.push(row);
    }
    const timeline = await fn({ useSignal, useQuery, useState });
    assertExists(timeline, "must return a function");
    assert(typeof timeline === "function", "must return a function");
    unrollSignals();
    init = true;
    let isCompleted, result;
    let timeoutRef: number | null = null;
    try {
      [isCompleted, result] = await Promise.race([
        timeline({
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
            repeat,
            checkpoint: function () {
              if (isReplay()) return;
            },
          },
          logger: {
            info(...args: unknown[]) {
              appendLog("info", args.map((a) => String(a)));
            },
            warn(...args: unknown[]) {
              appendLog("warn", args.map((a) => String(a)));
            },
            error(...args: unknown[]) {
              appendLog("error", args.map((a) => String(a)));
            },
            debug(...args: unknown[]) {
              appendLog("debug", args.map((a) => String(a)));
            },
          },
        }).then((data: unknown) => [true, data]),
        new Promise<[false, null]>((resolve) => {
          let i = 0;
          const iterate = () => {
            timeoutRef = Number(setTimeout(() => {
              i++;
              if (nPending === 0) {
                return resolve([false, null]);
              }
              iterate();
            }));
          };
          iterate();
        }),
      ]).finally(() => {
        if (timeoutRef !== null) clearTimeout(timeoutRef);
      });
    } catch (e) {
      const retryable = !(e instanceof NonRetriableError);
      return {
        status: "error",
        error: {
          message: e.message,
          stack: e.stack ?? "",
          name: e.name,
          retryable,
        },
        mutations: [],
        queries: {},
        state: {},
        result: null,
        logs: [],
      };
    }
    const detectedStates: Set<string> = new Set();

    const applyState = event.snapshot
      ? Object.fromEntries(
        Array.from(stateChanges).map((id) => [id, state[id]]),
      )
      : {};

    const applyQueries = Object.fromEntries(
      queries
        .map((q) => {
          detectedStates.clear();
          const res = q.cb();

          const hasRelevantStateChanges = detectedStates.size === 0 ||
            [...detectedStates].some((dep) => stateChanges.has(dep));

          return hasRelevantStateChanges ? [q.name, res] : null!;
        })
        .filter(Boolean),
    );

    if (isCompleted) {
      return {
        status: "completed",
        mutations,
        result,
        queries: applyQueries,
        state: applyState,
        error: null,
        logs,
      };
    }
    return {
      status: "incomplete",
      mutations,
      state: applyState,
      queries: applyQueries,
      error: null,
      result: null,
      logs,
    };
  }
  public getConfig(): FnsExternalConfig {
    return {
      checksum: this.version,
      definitions: this.definitions,
    };
  }
  createFunction(
    { name, version, schema }: {
      name: string;
      version: number;
      schema?: Schema;
    },
    fn: FnsFunction,
  ): FnsDefinition {
    const states: Record<string, unknown> = {};
    const queries: Set<string> = new Set();
    const signals: Set<string> = new Set();
    const remotes: Set<string> = new Set();
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
      });
      assertExists(output, "must return a function");
      assert(typeof output === "function", "must return a function");
    } catch (e) {
      throw new Error(
        `Failed to create function ${name}:${version} with message: ${e.message}`,
      );
    }
    const definition: FnsDefinition = {
      name,
      version,
      fn,
      states,
      remotes: Array.from(remotes),
      queries: Array.from(queries),
      signals: Array.from(signals),
      schema: schema ?? {},
    };
    return definition;
  }
  registerFunctions(definitions: FnsDefinition[]): void {
    for (let i = 0; i < definitions.length; i++) {
      const definition = definitions[i];
      this.definitions.set(definition.name, definition);
    }
    this.version = xxHash32(
      JSON.stringify(Array.from(this.definitions.values())),
    );
  }
}
