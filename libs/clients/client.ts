import { assert, assertExists } from "../../deps.ts";

export type FnsConfig = {
  dev?: boolean;
  baseUrl: string;
  signingKey?: string;
  apiKey?: string;
  fetch?: typeof fetch;
};
export type Pagined<T> = {
  data: T[];
  hasMore: boolean;
  cursor: string;
};
export type PaginationParams<T> = T & {
  ending_before?: string;
  starting_after?: string;
  limit?: number;
};
export class BaseClient {
  protected options: FnsConfig;
  constructor(options: FnsConfig) {
    this.options = options;
  }
  protected async request<T = unknown>(
    url: string | URL,
    method: "GET" | "POST",
    body?: unknown,
    idempotencyKey?: string | null,
  ): Promise<T> {
    assertExists(this.options.apiKey, "apiKey is required");
    assert(typeof this.options.apiKey === "string", "apiKey must be a string");
    const parsedURL = url instanceof URL
      ? url
      : new URL(url, this.options.baseUrl);
    const res = await (this.options.fetch ?? fetch)(parsedURL, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${this.options.apiKey}`,
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) throw new Error(`Failed to fetch ${parsedURL.pathname}`);
    return await res.json() as T;
  }
}
