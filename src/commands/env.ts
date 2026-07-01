import { Command } from "commander";
import { ApiClient } from "../api/client.ts";
import { resolveCredentials } from "../config.ts";
import { listEnvs, setEnvsBulk, deleteEnv, deploy } from "../api/resources.ts";
import { resolveUuid } from "../util/resolve.ts";
import { printResult } from "../util/output.ts";
import { watchDeployment } from "./deploy.ts";

function clientFor(profile?: string): ApiClient {
  return new ApiClient(resolveCredentials({ profile }));
}

export function envCommand(): Command {
  const cmd = new Command("env").description("Manage application environment variables");

  cmd
    .command("ls <app>")
    .option("--profile <name>", "profile to use")
    .option("--json", "output JSON", false)
    .action(async (app: string, o) => {
      const client = clientFor(o.profile);
      const uuid = await resolveUuid(client, "applications", app);
      printResult(await listEnvs(client, uuid), { json: o.json }, ["key", "value"]);
    });

  cmd
    .command("set <app> [pairs...]")
    .option("--profile <name>", "profile to use")
    .option("--redeploy", "deploy after setting", false)
    .action(async (app: string, pairs: string[], o) => {
      const client = clientFor(o.profile);
      const uuid = await resolveUuid(client, "applications", app);
      const data = pairs.map((p) => {
        const eq = p.indexOf("=");
        if (eq < 0) throw new Error(`Invalid pair "${p}", expected KEY=VALUE`);
        return { key: p.slice(0, eq), value: p.slice(eq + 1) };
      });
      await setEnvsBulk(client, uuid, data);
      console.log(`Set ${data.length} variable(s).`);
      if (o.redeploy) {
        const res = await deploy(client, uuid);
        const dep = res.deployments[0]?.deployment_uuid;
        if (dep) await watchDeployment(client, dep, { onStatus: (s) => console.log(`  ${s}`) });
      }
    });

  cmd
    .command("rm <app> <key>")
    .option("--profile <name>", "profile to use")
    .action(async (app: string, key: string, o) => {
      const client = clientFor(o.profile);
      const uuid = await resolveUuid(client, "applications", app);
      await deleteEnv(client, uuid, key);
      console.log(`Removed ${key}.`);
    });

  return cmd;
}
