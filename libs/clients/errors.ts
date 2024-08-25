import {
  BaseClient,
  type FnsConfig,
  type Pagination,
  type PaginationParams,
} from "./client.ts";

type Error = {
  id: string;
  name: string;
  message: string;
  stack: string;
  created_at: string;
};
type ErrorsListParams = PaginationParams<{
  execution_id: string;
  run_id: string;
}>;

export class ErrorsClient extends BaseClient {
  constructor(config: FnsConfig) {
    super(config);
  }
  /**
   * List all errors of a run
   * @example
   * const errors = await fns.errors.list({ execution_id: "...", run_id: "..." });
   */
  list(params: ErrorsListParams): Promise<Pagination<Error>> {
    const url = new URL(
      `/v1/errors/${params.execution_id}/${params.run_id}`,
      this.options.baseUrl,
    );
    if (params.limit) {
      url.searchParams.set("limit", String(params.limit));
    }
    if (params.cursor) {
      url.searchParams.set("cursor", params.cursor);
    }
    return this.request<Pagination<Error>>(url, "GET");
  }
}
