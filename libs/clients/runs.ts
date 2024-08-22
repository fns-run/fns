import {
  BaseClient,
  type FnsConfig,
  type PaginationParams,
  type Pagination,
} from "./client.ts";

export type Run = {
  tenant_id: string;
  execution_id: string;
  id: string;
  status: "running" | "completed" | "failed" | "aborted";
  created_at: string;
  updated_at: string;
};
export type RunRetrieveParams = {
  id: string;
  execution_id: string;
};
export type RunListParams = PaginationParams<{
  execution_id: string;
}>;

export class RunsClient extends BaseClient {
  constructor(config: FnsConfig) {
    super(config);
  }
  /**
   * List all runs of an execution.
   * @example
   * const runs = await fns.runs.list({ execution_id: "..." })
   */
  list(params: RunListParams): Promise<Pagination<Run>> {
    const url = new URL(
      `/api/v1/runs/${params.execution_id}`,
      this.options.baseUrl,
    );
    if (params.limit) {
      url.searchParams.set("limit", String(params.limit));
    }
    if (params.cursor) {
      url.searchParams.set("cursor", params.cursor);
    }
    return this.request<Pagination<Run>>(url, "GET");
  }

  /**
   * Retrieve a specific run by its ID.
   * @example
   * const value = await fns.runs.retrieve({ execution_id: "...", id: "..." })
   */
  retrieve(params: RunRetrieveParams): Promise<Run> {
    return this.request<Run>(
      `/api/v1/runs/${params.execution_id}/${params.id}`,
      "GET",
    );
  }
}