import {
  BaseClient,
  type FnsConfig,
  type PaginationParams,
  type Pagined,
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
   * const errors = await fns.errors.list({ id: "..." })
   */
  list(params: ErrorsListParams): Promise<Pagined<Error>> {
    const url = new URL(
      `/api/v1/errors/${params.execution_id}/${params.run_id}`,
      this.options.baseUrl,
    );
    url.searchParams.set("limit", String(params.limit ?? 10));
    if (params.ending_before) {
      url.searchParams.set("ending_before", params.ending_before);
    }
    if (params.starting_after) {
      url.searchParams.set("starting_after", params.starting_after);
    }
    return this.request<Pagined<Error>>(url, "GET");
  }
}
