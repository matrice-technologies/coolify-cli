import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Credentials = { url: string; token: string };
export type Config = { defaultProfile?: string; profiles: Record<string, Credentials> };

export class ConfigError extends Error {}

function defaultDir(): string {
  return join(homedir(), ".coolify");
}

export function loadConfig(dir: string = defaultDir()): Config {
  const file = join(dir, "config.json");
  if (!existsSync(file)) return { profiles: {} };
  return JSON.parse(readFileSync(file, "utf8")) as Config;
}

export function saveProfile(
  name: string,
  creds: Credentials,
  opts: { setDefault?: boolean; dir?: string } = {},
): void {
  const dir = opts.dir ?? defaultDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const config = loadConfig(dir);
  config.profiles[name] = creds;
  if (opts.setDefault || !config.defaultProfile) config.defaultProfile = name;
  writeFileSync(join(dir, "config.json"), JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function resolveCredentials(
  opts: { profile?: string; env?: NodeJS.ProcessEnv; config?: Config } = {},
): Credentials {
  const env = opts.env ?? process.env;
  if (env.COOLIFY_URL && env.COOLIFY_TOKEN) {
    return { url: env.COOLIFY_URL, token: env.COOLIFY_TOKEN };
  }
  const config = opts.config ?? loadConfig();
  const name = opts.profile ?? env.COOLIFY_PROFILE ?? config.defaultProfile;
  if (name && config.profiles[name]) return config.profiles[name];
  throw new ConfigError(
    "No Coolify credentials found. Set COOLIFY_URL/COOLIFY_TOKEN or run `coolify config set`.",
  );
}
