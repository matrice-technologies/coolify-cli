import { Command } from "commander";
import { ApiClient } from "../api/client.ts";
import { resolveCredentials } from "../config.ts";
import { listResources, getApplication, type ResourceKind } from "../api/resources.ts";
import { resolveUuid } from "../util/resolve.ts";
import { printResult } from "../util/output.ts";

function clientFor(profile?: string): ApiClient {
  return new ApiClient(resolveCredentials({ profile }));
}

export function lsCommand(): Command {
  return new Command("ls")
    .argument("[kind]", "applications|services|databases|projects|servers", "applications")
    .option("--profile <name>", "profile to use")
    .option("--json", "output JSON", false)
    .action((kind: ResourceKind, o) => {
      return listResources(clientFor(o.profile), kind).then((rows) =>
        printResult(rows, { json: o.json }, ["name", "uuid"]),
      );
    });
}

export function inspectCommand(): Command {
  return new Command("inspect")
    .argument("<target>", "app name or uuid")
    .option("--profile <name>", "profile to use")
    .option("--json", "output JSON", false)
    .action(async (target: string, o) => {
      const client = clientFor(o.profile);
      const uuid = await resolveUuid(client, "applications", target);
      printResult(await getApplication(client, uuid), { json: o.json });
    });
}
