import { Command } from "commander";
import { listResources, getApplication, type ResourceKind } from "../api/resources.ts";
import { resolveUuid } from "../util/resolve.ts";
import { printResult } from "../util/output.ts";
import { clientFor } from "../util/client.ts";

const CANONICAL_KINDS: ResourceKind[] = [
  "applications",
  "services",
  "databases",
  "projects",
  "servers",
];

const KIND_ALIASES: Record<string, ResourceKind> = {
  app: "applications",
  apps: "applications",
  service: "services",
  db: "databases",
  database: "databases",
  project: "projects",
  server: "servers",
};

export function normalizeKind(input: string): ResourceKind {
  const resolved = KIND_ALIASES[input] ?? (input as ResourceKind);
  if (!CANONICAL_KINDS.includes(resolved)) {
    throw new Error(`Unknown kind "${input}". Valid: ${CANONICAL_KINDS.join(", ")}`);
  }
  return resolved;
}

export function lsCommand(): Command {
  return new Command("ls")
    .argument("[kind]", "applications|services|databases|projects|servers", "applications")
    .option("--profile <name>", "profile to use")
    .option("--json", "output JSON", false)
    .action((kind: string, o) => {
      const resolved = normalizeKind(kind);
      return listResources(clientFor(o.profile), resolved).then((rows) =>
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
