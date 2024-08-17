export interface FnsOptions {
  dev?: boolean;
  endpoint?: string;
  signingKey?: string;
  apiKey?: string;
}
export interface Query {
  name: string;
  cb: () => unknown;
  dependencies: string[];
}
export type Callback<T = unknown> = () => T;
export interface StateGetter<T = unknown> extends Callback<T> {
  id: string;
}
export interface FnsQueryValue<T> {
  value: T;
  timestamp: string;
  version: number;
}
export type FnsFunctionParams = {
  useSignal<T = unknown>(name: string, cb: (data: T) => void): void;
  useQuery<T = unknown>(
    name: string,
    cb: () => T,
    dependencies?: StateGetter[],
  ): void;
  useState<T = unknown>(
    id: string,
    initial: T,
  ): [
    () => T,
    (
      newState:
        | T
        | ((prevState: T) => T),
    ) => void,
  ];
};
export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}
export type FnsFunction = (params: FnsFunctionParams) => (execution: {
  ctx: {
    id: string;
    run_id: string;
    data: unknown;
  };
  step: {
    checkpoint(): void;
    run<T = unknown>(id: string, step: () => T | Promise<T>): Promise<T>;
    condition(
      id: string,
      cb: () => boolean,
      timeout?: string | number,
    ): Promise<boolean>;
    sleep(id: string, timeout: string | number): Promise<void>;
    sleepUntil(id: string, until: Date | string): Promise<void>;
    /*repeat(
      id: string,
      cron: string | { every?: string | number; times?: number },
      cb: (idx: number) => undefined | boolean | Promise<undefined | boolean>,
    ): Promise<void>;*/
    lock(
      id: string,
      keys: string[],
      timeout?: string | number,
    ): Promise<boolean>;
    unlock(id: string, keys?: string[]): Promise<void>;
  };
  logger: Logger;
  abortSignal: AbortSignal;
}) => Promise<unknown>;

export type FnsRequestParams = {
  id: string;
  run_id: string;
  name: string;
  data: unknown;
  /* system */
  version: number;
  checksum: number;
  snapshot: boolean;
  steps: Step[];
  state: Record<string, unknown>;
};

export type Params =
  | { signal: string }
  | { timeout: number }
  | { until: string }
  | { keys: string[] }
  | null;
export type StepType =
  | "run"
  | "sleep"
  | "condition"
  | "signal"
  | "lock"
  | "unlock";
export type Step = {
  id: string;
  type: StepType;
  params: Params;
  status: "pending" | "completed";
  result: unknown;
};
export type MutationInitization = {
  status: "pending";
  type: StepType;
  params: Params;
};
export type MutationCompleted = {
  status: "completed";
  result: unknown;
  elapsed: number;
};
export type Mutation =
  & {
    id: string;
  }
  & (MutationInitization | MutationCompleted);

export type FnsResponse = {
  status: "completed" | "incomplete" | "error";
  mutations: Mutation[];
  queries: Record<string, unknown>;
  state: Record<string, unknown>;
  error: {
    message: string;
    stack: string;
    name: string;
    retryable: boolean;
  } | null;
  result: unknown;
};

export type Schema = {
  data?: unknown; // to define, replace unknown with JSON schema
  signals?: Record<string, unknown>; // to define, replace unknown with JSON schema
};
