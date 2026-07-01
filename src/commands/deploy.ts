// src/commands/deploy.ts
import { ApiClient } from "../api/client.ts";
import { getDeployment } from "../api/resources.ts";

const SUCCESS = new Set(["finished"]);
const FAILURE = new Set(["failed", "error", "cancelled"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type DeployOutcome = "finished" | "failed" | "timeout";

export async function watchDeployment(
  client: ApiClient,
  deploymentUuid: string,
  opts: { intervalMs?: number; onStatus?: (s: string) => void; maxPolls?: number } = {},
): Promise<DeployOutcome> {
  const interval = opts.intervalMs ?? 2000;
  const maxPolls = opts.maxPolls ?? 600;
  for (let n = 0; n < maxPolls; n++) {
    const { status } = await getDeployment(client, deploymentUuid);
    opts.onStatus?.(status);
    if (SUCCESS.has(status)) return "finished";
    if (FAILURE.has(status)) return "failed";
    await sleep(interval);
  }
  return "timeout";
}

/**
 * Print a message for a deploy outcome and set process.exitCode on non-success.
 * `label` is the app/target name used in the timeout hint.
 * `timeoutHint` lets callers vary the wording preceding the inspect suggestion.
 */
export function reportDeployOutcome(
  outcome: DeployOutcome,
  label: string,
  timeoutHint = "Deploy still running",
): void {
  if (outcome === "finished") {
    console.log("Deploy finished.");
  } else if (outcome === "failed") {
    console.error("Deploy failed.");
    process.exitCode = 1;
  } else {
    console.error(`${timeoutHint}; check status with \`coolify inspect ${label}\`.`);
    process.exitCode = 1;
  }
}
