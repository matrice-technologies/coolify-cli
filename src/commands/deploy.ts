// src/commands/deploy.ts
import { ApiClient } from "../api/client.ts";
import { getDeployment } from "../api/resources.ts";

const SUCCESS = new Set(["finished"]);
const FAILURE = new Set(["failed", "error", "cancelled"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function watchDeployment(
  client: ApiClient,
  deploymentUuid: string,
  opts: { intervalMs?: number; onStatus?: (s: string) => void; maxPolls?: number } = {},
): Promise<"finished" | "failed"> {
  const interval = opts.intervalMs ?? 2000;
  const maxPolls = opts.maxPolls ?? 600;
  for (let n = 0; n < maxPolls; n++) {
    const { status } = await getDeployment(client, deploymentUuid);
    opts.onStatus?.(status);
    if (SUCCESS.has(status)) return "finished";
    if (FAILURE.has(status)) return "failed";
    await sleep(interval);
  }
  return "failed";
}
