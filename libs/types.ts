import { z } from "../deps.ts";

export const zStepType = z.union([
  z.literal("run"),
  z.literal("sleep"),
  z.literal("condition"),
  z.literal("signal"),
  z.literal("lock"),
  z.literal("unlock"),
  z.literal("invoke"),
  z.literal("trigger"),
  z.literal("query"),
  z.literal("get"),
]);
export const zParams = z.union([
  z.object({
    signal: z.string(),
  }).strict(),
  z.object({
    timeout: z.number(),
  }).strict(),
  z.object({
    until: z.string(),
  }).strict(),
  z.object({
    keys: z.array(z.string()),
  }).strict(),
  z.null(),
]);

export const zStep = z.object({
  id: z.string(),
  type: zStepType,
  params: zParams,
  completed: z.boolean(),
  result: z.unknown(),
}).strict();
export const zFnsRequestParams = z.object({
  id: z.string(),
  run_id: z.string(),
  name: z.string(),
  data: z.unknown(),
  snapshot: z.boolean(),
  steps: z.array(zStep),
  state: z.record(z.unknown()),
});
export type zStep = z.infer<typeof zStep>;
export type zStepType = z.infer<typeof zStepType>;
export type zParams = z.infer<typeof zParams>;
export type zFnsRequestParams = z.infer<typeof zFnsRequestParams>;

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
export type FnsRemoteFunction = {
  get<T = unknown>(id: string, options: { id: string }): Promise<T>;
  invoke<T = unknown>(
    id: string,
    options: { id?: string; data?: unknown },
  ): Promise<T>;
  trigger(
    id: string,
    options: { id: string; signal: string; data?: unknown },
  ): Promise<void>;
  query<T = unknown>(
    id: string,
    options: { id: string; query: string },
  ): Promise<FnsQueryValue<T>>;
  result<T = unknown>(id: string): Promise<T>;
};
export type FnsFunctionParams = {
  useSignal<T = unknown>(name: string, cb: (data: T) => void): void; // TODO: () => T | undefined;
  useQuery<T = unknown>(
    name: string,
    cb: () => T,
    dependencies?: StateGetter[],
  ): void; // trouver un moyen de detecter les dépendances avec microtasks et potentiellement ne pas demander de dépendances
  useState<T = unknown>(
    id: string,
    initial?: T,
  ): [
    () => typeof initial,
    (
      newState:
        | typeof initial
        | ((prevState: typeof initial) => typeof initial),
    ) => void,
  ];
  useFunctions(functions: string[]): Record<string, FnsRemoteFunction>;
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
    // enlever les options et mettre juste fn
    // mettre en place une vérification des ids uniques et slugify correct
    checkpoint(): Promise<boolean>;
    run<T = unknown>(id: string, step: () => T | Promise<T>): Promise<T>; // potentiellement mettre des paramètres
    condition(
      id: string,
      cb: () => boolean,
      timeout?: string | number,
    ): Promise<boolean>;
    sleep(id: string, timeout: string | number): Promise<void>;
    sleepUntil(id: string, until: Date | string): Promise<void>;
    // ne pas mettre de timeout? si timeout alors ça doit être le scheduler de lock qui gère
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
  | "unlock"
  | "invoke"
  | "trigger"
  | "query"
  | "get";
export type Step = {
  id: string;
  type: StepType;
  params: Params;
  completed: boolean;
  result: unknown;
};
export type MutationInitization = {
  type: StepType;
  params: Params;
};
export type MutationCompleted = {
  completed: true;
  result: unknown;
  elapsed: number;
};
export type Mutation =
  & { id: string; completed: boolean }
  & (MutationInitization | MutationCompleted);

export type FnsCompletedResponse = {
  completed: true;
  result: unknown;
};
export type FnsIncompleteResponse = {
  completed: false;
  mutations: Mutation[];
  state?: Record<string, unknown>;
};
export type FnsErrorResponse = {
  completed: false;
  error: {
    message: string;
    stack: string;
    name: string;
    retryable: boolean;
  };
};
export type FnsResponse =
  & { completed: boolean; queries?: Record<string, unknown> }
  & (FnsCompletedResponse | FnsIncompleteResponse | FnsErrorResponse);

export type Schema = {
  data?: unknown; // to define, replace unknown with JSON schema
  signals?: Record<string, unknown>; // to define, replace unknown with JSON schema
};
