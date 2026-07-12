// src/api/resources.ts
import { ApiClient, NotFoundError } from "./client.ts";

export type Resource = { uuid: string; name: string; [k: string]: unknown };
export type ResourceKind = "applications" | "services" | "databases" | "projects" | "servers";
export type EnvVar = { key: string; value: string; uuid?: string; [k: string]: unknown };

export function listResources(client: ApiClient, kind: ResourceKind): Promise<Resource[]> {
  return client.request<Resource[]>("GET", `/${kind}`);
}

export function getApplication(client: ApiClient, uuid: string): Promise<Resource> {
  return client.request<Resource>("GET", `/applications/${uuid}`);
}

export function listEnvs(client: ApiClient, uuid: string): Promise<EnvVar[]> {
  return client.request<EnvVar[]>("GET", `/applications/${uuid}/envs`);
}

export async function setEnvsBulk(
  client: ApiClient,
  uuid: string,
  data: { key: string; value: string }[],
): Promise<EnvVar[]> {
  try {
    return await client.request<EnvVar[]>("PATCH", `/applications/${uuid}/envs/bulk`, { data });
  } catch (err) {
    if (err instanceof NotFoundError) {
      // Fallback: loop single-var updates when bulk route is unavailable.
      for (const item of data) await setEnvSingle(client, uuid, item.key, item.value);
      return [];
    }
    throw err;
  }
}

export async function setEnvSingle(
  client: ApiClient,
  uuid: string,
  key: string,
  value: string,
): Promise<void> {
  await client.request("PATCH", `/applications/${uuid}/envs`, { key, value });
}

/**
 * Delete the environment variable(s) named `key` from an application.
 *
 * The Coolify v4 API matches env vars by their own uuid, not by key name, so we
 * resolve the key to its uuid(s) via listEnvs first and DELETE each by uuid.
 * A key can map to more than one entry (e.g. a production copy with
 * is_preview:false and a preview copy with is_preview:true, each with a distinct
 * uuid); every match is deleted. Returns the number of entries removed.
 */
export async function deleteEnv(client: ApiClient, uuid: string, key: string): Promise<number> {
  const matches = (await listEnvs(client, uuid)).filter((e) => e.key === key);
  if (matches.length === 0) {
    throw new Error(`Environment variable "${key}" not found.`);
  }
  if (matches.some((e) => !e.uuid)) {
    throw new Error(`Cannot delete "${key}": Coolify returned an entry without a uuid.`);
  }
  for (const env of matches) {
    await client.request("DELETE", `/applications/${uuid}/envs/${env.uuid}`);
  }
  return matches.length;
}

export function deploy(
  client: ApiClient,
  uuid: string,
  opts: { force?: boolean } = {},
): Promise<{ deployments: { deployment_uuid: string }[] }> {
  const force = opts.force ? "&force=true" : "";
  return client.request("GET", `/deploy?uuid=${encodeURIComponent(uuid)}${force}`);
}

export function getDeployment(
  client: ApiClient,
  deploymentUuid: string,
): Promise<{ status: string; [k: string]: unknown }> {
  return client.request("GET", `/deployments/${deploymentUuid}`);
}
