import { type JSONSchema } from "json-schema-typed/draft-2019-09";

export interface Options {
  devMode?: boolean;
  strict?: boolean;
  apikey?: string;
  secret?: string;
}

export class NonRetriableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetriableError";
  }
}

export type WorkflowParams = {
  useSignal<T = any>(name: string, cb: (data:T) => void): void;
  useQuery<T = any>(name: string, cb: () => T, dependencies?: any[]): void;
  useState<T = any>(initial: T): [() => typeof initial, (newState: typeof initial | ((prevState: typeof initial) => typeof initial)) => void];
}
export type WorkflowFunction = (params: WorkflowParams) => ({ event }: {
  event: Omit<HandlerParams, "ops" | "state" | "snapshot">;
  step: {
    run<T = any>(name: string, step: (...args: any[]) => T | Promise<T>, options?: { retry?: (number | string)[]; }): Promise<any>;
    condition(name: string, cb: () => boolean, timeout?: string | number): Promise<any>;
    sleep(name: string, timeout: string | number): Promise<void>;
    sleepUntil(name: string, until: Date | string): Promise<void>;
    lock(name: string, keys: string[], timeout?: string | number): Promise<boolean>;
    unlock(name: string, keys?: string[]): Promise<void>;
  };
  abortSignal: AbortSignal;
}) => Promise<any>;
export type HandlerParams = {
  id: string;
  name: string;
  data: any;
  snapshot?: boolean;
  ops?: Op[];
  state?: any[];
}
export type Op = {
  id?: string;
  status: "initialized" | "pending" | "completed";
  type?: ("run" | "sleep" | "condition" | "signal" | "return" | "lock" | "unlock") & string;
  params?: {
    name: string;
    timeout?: number;
    until?: string;
    keys?: string[];
  }
  result?: any;
  executionTime?: number
};
export type HandlerResponse = {
  status: "completed" | "incomplete" | "error";
  ops: Op[];
  state?: Record<string, any>;
  queries?: Record<string, any>;
  /*signals?: string[];*/
  result?: any;
  error?: { retryable: boolean } & Error;
};

export type Schema = {
  data?: JSONSchema,
  signals?: Record<string, JSONSchema>,
}