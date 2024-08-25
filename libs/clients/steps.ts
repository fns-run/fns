import {
  BaseClient,
  type FnsConfig,
  type Pagination,
  type PaginationParams,
} from "./client.ts";

export type Step = {
  tenant_id: string;
  execution_id: string;
  id: string;
  status: "pending" | "completed";
  type: "run" | "sleep" | "condition" | "signal";
  params: unknown;
  elapsed: number | null;
  result: null | { size: number };
  is_expired: boolean;
  created_at: string;
  updated_at: string;
};
export type StepRetrieveParams = {
  id: string;
  execution_id: string;
};
export type StepListParams = PaginationParams<{
  execution_id: string;
}>;

export class StepsClient extends BaseClient {
  constructor(config: FnsConfig) {
    super(config);
  }
  /**
   * List all steps of an execution.
   * @example
   * const steps = await fns.steps.list({ execution_id: "..." })
   */
  list(params: StepListParams): Promise<Pagination<Step>> {
    const url = new URL(
      `/v1/steps/${params.execution_id}`,
      this.options.baseUrl,
    );
    if (params.limit) {
      url.searchParams.set("limit", String(params.limit));
    }
    if (params.cursor) {
      url.searchParams.set("cursor", params.cursor);
    }
    return this.request<Pagination<Step>>(url, "GET");
  }

  /**
   * Retrieve a specific query by its ID.
   * @example
   * const step = await fns.steps.retrieve({ execution_id: "..." })
   */
  retrieve(params: StepRetrieveParams): Promise<Step> {
    return this.request<Step>(
      `/v1/steps/${params.execution_id}/${params.id}`,
      "GET",
    );
  }
}
