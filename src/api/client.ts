import type { Credentials } from "../config.ts";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export class AuthError extends ApiError {}
export class NotFoundError extends ApiError {}
export class ValidationError extends ApiError {}

export class ApiClient {
  private base: string;
  constructor(
    private creds: Credentials,
    private fetchImpl: typeof fetch = fetch,
  ) {
    this.base = creds.url.replace(/\/+$/, "") + "/api/v1";
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(this.base + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.creds.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const msg = (data && data.message) || `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) throw new AuthError(res.status, msg);
      if (res.status === 404) throw new NotFoundError(res.status, msg);
      if (res.status === 422) throw new ValidationError(res.status, msg);
      throw new ApiError(res.status, msg);
    }
    return data as T;
  }
}
