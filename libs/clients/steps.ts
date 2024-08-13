import {
  BaseClient,
  type FnsConfig,
  type PaginationParams,
  type Pagined,
} from "./client.ts";

type Query = {
  name: string;
  size: number;
  version: number;
  updated_at: string;
};
type QueryValue<T> = {
  value: T;
  timestamp: string;
  version: number;

  updated_at: string;
};
type QueryRetrieveParams = {
  id: string;
  query: string;
};
type QueryListParams = PaginationParams<{
  execution_id: string;
}>;

export class StepsClient extends BaseClient {
  constructor(config: FnsConfig) {
    super(config);
  }
  /**
   * List all steps of an execution.
   * @example
   * const queries = await fns.queries.list({ id: "..." })
   */
  list(params: QueryListParams): Promise<Pagined<Query>> {
    const url = new URL(
      `/api/v1/queries/${params.execution_id}`,
      this.options.baseUrl,
    );
    url.searchParams.set("limit", String(params.limit ?? 10));
    if (params.ending_before) {
      url.searchParams.set("ending_before", params.ending_before);
    }
    if (params.starting_after) {
      url.searchParams.set("starting_after", params.starting_after);
    }
    return this.request<Pagined<Query>>(url, "GET");
  }

  /**
   * Retrieve a specific query by its ID.
   * @example
   * const value = await fns.queries.retrieve({ id: "...", query: "..." })
   */
  retrieve<T = unknown>(params: QueryRetrieveParams): Promise<QueryValue<T>> {
    return this.request<QueryValue<T>>(
      `/api/v1/queries/${params.id}/${params.query}`,
      "GET",
    );
  }
}
