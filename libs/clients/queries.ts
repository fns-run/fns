import {
  BaseClient,
  type FnsConfig,
  type Pagination,
  type PaginationParams,
} from "./client.ts";

export type Query = {
  name: string;
  size: number;
  version: number;
  updated_at: string;
};
export type QueryValue<T> = {
  value: T;
  timestamp: string;
  version: number;
  updated_at: string;
};
export type QueryRetrieveParams = {
  id: string;
  query: string;
};
export type QueryListParams = PaginationParams<{
  execution_id: string;
}>;

export class QueriesClient extends BaseClient {
  constructor(config: FnsConfig) {
    super(config);
  }
  /**
   * List all queries of an execution.
   * @example
   * const queries = await fns.queries.list({ id: "..." })
   */
  list(params: QueryListParams): Promise<Pagination<Query>> {
    const url = new URL(
      `/v1/queries/${params.execution_id}`,
      this.options.baseUrl,
    );
    if (params.limit) {
      url.searchParams.set("limit", String(params.limit));
    }
    if (params.cursor) {
      url.searchParams.set("cursor", params.cursor);
    }
    return this.request<Pagination<Query>>(url, "GET");
  }

  /**
   * Retrieve a specific query by its ID.
   * @example
   * const value = await fns.queries.retrieve({ id: "...", query: "..." })
   */
  retrieve<T = unknown>(params: QueryRetrieveParams): Promise<QueryValue<T>> {
    return this.request<QueryValue<T>>(
      `/v1/queries/${params.id}/${params.query}`,
      "GET",
    );
  }
}
