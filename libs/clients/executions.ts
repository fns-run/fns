import {
  BaseClient,
  type FnsConfig,
  type PaginationParams,
  type Pagination,
} from "./client.ts";

export type Execution = {
  id: string;
  name: string;
  data: { size: number } | null;
  result: { size: number } | null;
  status: "running" | "waiting" | "completed" | "failed" | "paused" | "aborted";
  created_at: string;
  updated_at: string;
};
export type ExecutionInvokeParams = {
  id?: string;
  name: string;
  data: unknown;
  wait?: boolean;
  idempotencyKey?: string;
};
export type ExecutionTriggerParams = {
  id: string;
  signal: string;
  data?: unknown;
  idempotencyKey?: string;
};
export type ExecutionAbortParams = {
  id: string;
};
export type ExecutionPauseParams = {
  id: string;
  idempotencyKey?: string;
};
export type ExecutionResumeParams = {
  id: string;
  idempotencyKey?: string;
};
export type ExecutionResultParams = {
  id: string;
};
export type ExecutionDataParams = {
  id: string;
};
export type ExecutionListParams = PaginationParams<{
  status?: "running" | "waiting" | "completed" | "failed" | "aborted";
  name?: string;
}>;

export class ExecutionsClient extends BaseClient {
  constructor(config: FnsConfig) {
    super(config);
  }
  /**
   * List all executions regardless of subject.
   * @example
   * const executions = await fns.executions.list()
   */
  list(params?: ExecutionListParams): Promise<Pagination<Execution>> {
    const url = new URL("/api/v1/executions", this.options.baseUrl);
    if (params) {
      if (params.limit) {
        url.searchParams.set("limit", String(params.limit));
      }
      if(params.status) {
        url.searchParams.set("status", params.status);
      }
      if(params.name) {
        url.searchParams.set("name", params.name);
      }
      if (params.cursor) {
        url.searchParams.set("cursor", params.cursor);
      }
    }
    return this.request<Pagination<Execution>>(url, "GET");
  }

  /**
   * Retrieve a specific execution by its ID.
   * @example
   * const execution = await fns.executions.retrieve("id")
   */
  retrieve(id: string): Promise<Execution> {
    return this.request<Execution>(`/api/v1/executions/${id}`, "GET");
  }

  /**
   * Invoke a new execution.
   * @example
   * const execution = await fns.executions.invoke({ id: "id", name: "name", data: {} })
   */
  invoke<T>(params: ExecutionInvokeParams & { wait: true }): Promise<T>;
  invoke<T>(
    params: ExecutionInvokeParams & { wait?: false },
  ): Promise<Execution>;
  async invoke<T = unknown>(
    params: ExecutionInvokeParams,
  ): Promise<T | Execution> {
    const execution = await this.request<Execution>(
      "/api/v1/executions",
      "POST",
      params,
    );
    if (params.wait) {
      return await this.result<T>({ id: execution.id });
    }
    return execution;
  }

  /**
   * Trigger an execution.
   * @example
   * const execution = await fns.executions.trigger({ id: "id", signal: "signal", data: {} })
   */
  trigger(params: ExecutionTriggerParams): Promise<void> {
    return this.request<void>(
      `/api/v1/executions/${params.id}/trigger`,
      "POST",
      params.data ?? null,
      params.idempotencyKey,
    );
  }

  /**
   * Abort an execution.
   * @example
   * const execution = await fns.executions.abort({ id: "..." })
   */
  abort(params: ExecutionAbortParams): Promise<Execution> {
    return this.request<Execution>(
      `/api/v1/executions/${params.id}/abort`,
      "POST",
    );
  }

  /**
   * Pause an execution.
   * @example
   * const execution = await fns.executions.pause("id")
   */
  pause(params: ExecutionPauseParams): Promise<Execution> {
    return this.request<Execution>(
      `/api/v1/executions/${params.id}/pause`,
      "POST",
      null,
      params.idempotencyKey,
    );
  }

  /**
   * Resume an execution.
   * @example
   * const execution = await fns.executions.resume("id")
   */
  resume(params: ExecutionResumeParams): Promise<Execution> {
    return this.request<Execution>(
      `/api/v1/executions/${params.id}/resume`,
      "POST",
      null,
      params.idempotencyKey,
    );
  }

  /**
   * Get or wait for the result of an execution.
   * @example
   * const result = await fns.executions.result("id")
   */
  result<T = unknown>(params: ExecutionResultParams): Promise<T> {
    return this.request<T>(`/api/v1/executions/${params.id}/result`, "GET");
  }

  /**
   * Get data of an execution.
   * @example
   * const data = await fns.executions.data({ id: "..." })
   */
  data<T = unknown>(params: ExecutionDataParams): Promise<T> {
    return this.request<T>(`/api/v1/executions/${params.id}/data`, "GET");
  }
}
