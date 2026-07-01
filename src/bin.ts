#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { deploy } from "./api/resources.ts";
import { resolveUuid } from "./util/resolve.ts";
import { clientFor } from "./util/client.ts";
import { watchDeployment, reportDeployOutcome } from "./commands/deploy.ts";
import { configCommand } from "./commands/config.ts";
import { lsCommand, inspectCommand } from "./commands/list.ts";
import { envCommand } from "./commands/env.ts";

export const VERSION = "0.1.0";

export function buildProgram(): Command {
  const program = new Command("coolify").version(VERSION);
  program.addCommand(configCommand());
  program.addCommand(lsCommand());
  program.addCommand(inspectCommand());
  program.addCommand(envCommand());

  program
    .command("deploy <target>")
    .option("--profile <name>", "profile to use")
    .option("--force", "force rebuild", false)
    .option("--no-watch", "do not wait for completion")
    .action(async (target: string, o) => {
      const client = clientFor(o.profile);
      const uuid = await resolveUuid(client, "applications", target);
      const res = await deploy(client, uuid, { force: o.force });
      const dep = res.deployments[0]?.deployment_uuid;
      console.log(`Triggered deploy ${dep ?? "(unknown)"}.`);
      if (o.watch && dep) {
        const result = await watchDeployment(client, dep, { onStatus: (s) => console.log(`  ${s}`) });
        reportDeployOutcome(result, target, "Deploy still running after polling");
      }
    });

  return program;
}

async function main() {
  try {
    await buildProgram().parseAsync(process.argv);
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  }
}

/**
 * True when this module is the process entry point (run directly), false when
 * imported (e.g. by tests). Resolves symlinks so it works when invoked via a
 * globally linked bin (`npm link` → /usr/local/bin/coolify → real dist path)
 * and handles paths with spaces / Windows via pathToFileURL.
 */
export function isMainModule(
  metaUrl: string = import.meta.url,
  argv1: string | undefined = process.argv[1],
): boolean {
  if (!argv1) return false;
  try {
    return metaUrl === pathToFileURL(realpathSync(argv1)).href;
  } catch {
    return false;
  }
}

// Run only when invoked directly, not when imported by tests.
if (isMainModule()) {
  void main();
}
