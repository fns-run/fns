export class NonRetriableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetriableError";
  }
}
export interface FnsQueryValue<T> {
  value: T;
  timestamp: string;
  version: number;
}
export type FnsFunctionParams = {
  useSignal<T = any>(name: string, cb: (data: T) => void): void; // TODO: () => T | undefined;
  useQuery<T = any>(name: string, cb: () => T, dependencies?: any[]): void; // trouver un moyen de detecter les dépendances avec microtasks et potentiellement ne pas demander de dépendances
  useState<T = any>(
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
  useFunctions(functions: string[]): Record<string, {
    get<T = any>(id: string, options: { id: string }): Promise<T>;
    invoke<T = any>(
      id: string,
      options: { id?: string; data: any },
    ): Promise<T>;
    trigger(
      id: string,
      options: { id: string; signal: string; data: any },
    ): Promise<void>;
    query<T = any>(
      id: string,
      options: { id: string; query: string },
    ): Promise<FnsQueryValue<T>>;
    result<T = any>(id: string): Promise<T>;
  }>;
};
export interface Logger {
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  debug(...args: any[]): void;
}
export type FnsFunction = (params: FnsFunctionParams) => (execution: {
  ctx: {
    id: string;
    run_id: string;
    data: any;
  };
  step: {
    // enlever les options et mettre juste fn
    // mettre en place une vérification des ids uniques et slugify correct
    checkpoint(): Promise<boolean>;
    run<T = any>(id: string, step: () => T | Promise<T>): Promise<T>; // potentiellement mettre des paramètres
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
}) => Promise<any>;

export type FnsRequestParams = {
  id: string;
  run_id: string;
  name: string;
  data: any;
  snapshot: boolean;
  steps: Step[];
  state: Record<string, any>;
};

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
  params: { signal: string } | { timeout: number } | { until: string } | {
    keys: string[];
  } | null;
  completed: boolean;
  result: any;
};
export type MutationInitization = {
  type: StepType;
  params: { signal: string } | { timeout: number } | { until: string } | {
    keys: string[];
  } | null;
};
export type MutationCompleted = {
  completed: true;
  result: any;
  elapsed: number;
};
export type Mutation =
  & { id: string; completed: boolean }
  & (MutationInitization | MutationCompleted);

export type FnsCompletedResponse = {
  completed: true;
  result: any;
};
export type FnsIncompleteResponse = {
  completed: false;
  mutations: Mutation[];
  state?: Record<string, any>;
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
  & { completed: boolean; queries?: Record<string, any> }
  & (FnsCompletedResponse | FnsIncompleteResponse | FnsErrorResponse);

export type Schema = {
  data?: any; // to define
  signals?: Record<string, any>; // to define
};
