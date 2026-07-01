import { ApiClient } from "../api/client.ts";
import { resolveCredentials } from "../config.ts";

export function clientFor(profile?: string): ApiClient {
  return new ApiClient(resolveCredentials({ profile }));
}
