// src/util/resolve.ts
import { ApiClient } from "../api/client.ts";
import { listResources, type ResourceKind } from "../api/resources.ts";

export class ResolveError extends Error {}

const UUID_LIKE = /^[0-9a-z]{16,}$/i;

export async function resolveUuid(
  client: ApiClient,
  kind: ResourceKind,
  nameOrUuid: string,
): Promise<string> {
  if (UUID_LIKE.test(nameOrUuid) || /^[0-9a-f-]{20,}$/i.test(nameOrUuid)) return nameOrUuid;
  const all = await listResources(client, kind);
  const matches = all.filter((r) => r.name === nameOrUuid);
  if (matches.length === 1) return matches[0].uuid;
  if (matches.length === 0) {
    throw new ResolveError(
      `No ${kind} named "${nameOrUuid}". Available: ${all.map((r) => r.name).join(", ") || "(none)"}`,
    );
  }
  throw new ResolveError(
    `Multiple ${kind} named "${nameOrUuid}": ${matches.map((r) => r.uuid).join(", ")}. Use a UUID.`,
  );
}
