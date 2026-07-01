#!/usr/bin/env node
import { Command } from "commander";
import { ApiClient } from "./api/client.ts";
import { resolveCredentials } from "./config.ts";
import { deploy } from "./api/resources.ts";
import { resolveUuid } from "./util/resolve.ts";
import { watchDeployment } from "./commands/deploy.ts";
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
      const client = new ApiClient(resolveCredentials({ profile: o.profile }));
      const uuid = await resolveUuid(client, "applications", target);
      const res = await deploy(client, uuid, { force: o.force });
      const dep = res.deployments[0]?.deployment_uuid;
      console.log(`Triggered deploy ${dep ?? "(unknown)"}.`);
      if (o.watch && dep) {
        const result = await watchDeployment(client, dep, { onStatus: (s) => console.log(`  ${s}`) });
        if (result === "failed") {
          console.error("Deploy failed.");
          process.exitCode = 1;
        } else {
          console.log("Deploy finished.");
        }
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

// Run only when invoked directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
