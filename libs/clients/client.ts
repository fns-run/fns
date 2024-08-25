import { assert } from "../../deps.ts";
import { ApiKeyRequiredError } from "../errors.ts";

export type FnsConfig = {
  dev?: boolean;
  baseUrl: string;
  signingKey?: string;
  apiKey?: string;
  fetch?: typeof fetch;
};
export type Pagination<T> = {
  results: T[];
  hasMore: boolean;
  cursor: string;
};
export type PaginationParams<T> = T & {
  cursor?: string;
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
    if (!this.options.apiKey) throw new ApiKeyRequiredError();
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
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    return await res.json() as T;
  }
}
