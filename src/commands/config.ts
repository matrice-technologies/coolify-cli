import { Command } from "commander";
import { saveProfile, loadConfig } from "../config.ts";
import { renderTable } from "../util/output.ts";

export function configCommand(): Command {
  const cmd = new Command("config").description("Manage Coolify profiles");

  cmd
    .command("set")
    .requiredOption("--profile <name>", "profile name")
    .requiredOption("--url <url>", "Coolify base URL")
    .requiredOption("--token <token>", "API token")
    .option("--default", "set as default profile", false)
    .action((o) => {
      saveProfile(o.profile, { url: o.url, token: o.token }, { setDefault: o.default });
      console.log(`Saved profile "${o.profile}".`);
    });

  cmd
    .command("use <name>")
    .action((name) => {
      const cfg = loadConfig();
      if (!cfg.profiles[name]) throw new Error(`No profile "${name}".`);
      saveProfile(name, cfg.profiles[name], { setDefault: true });
      console.log(`Default profile is now "${name}".`);
    });

  cmd.command("ls").action(() => {
    const cfg = loadConfig();
    const rows = Object.entries(cfg.profiles).map(([name, c]) => ({
      name,
      url: c.url,
      default: name === cfg.defaultProfile ? "*" : "",
    }));
    console.log(renderTable(rows, ["name", "url", "default"]));
  });

  return cmd;
}
