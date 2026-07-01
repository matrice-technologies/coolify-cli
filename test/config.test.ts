import { describe, it, expect } from "vitest";
import { mkdtempSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveCredentials, ConfigError, saveProfile, loadConfig } from "../src/config.ts";

describe("resolveCredentials", () => {
  it("prefers env vars", () => {
    const creds = resolveCredentials({
      env: { COOLIFY_URL: "https://e.com", COOLIFY_TOKEN: "t" },
      config: { profiles: {} },
    });
    expect(creds).toEqual({ url: "https://e.com", token: "t" });
  });

  it("falls back to named profile", () => {
    const creds = resolveCredentials({
      profile: "prod",
      env: {},
      config: { profiles: { prod: { url: "https://p.com", token: "p" } } },
    });
    expect(creds.url).toBe("https://p.com");
  });

  it("uses defaultProfile when no flag", () => {
    const creds = resolveCredentials({
      env: {},
      config: { defaultProfile: "prod", profiles: { prod: { url: "https://d.com", token: "d" } } },
    });
    expect(creds.token).toBe("d");
  });

  it("throws ConfigError when nothing resolves", () => {
    expect(() => resolveCredentials({ env: {}, config: { profiles: {} } })).toThrow(ConfigError);
  });
});

describe("saveProfile / loadConfig round-trip", () => {
  it("writes config.json with mode 0600 and reads back the profile", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "coolify-"));
    try {
      saveProfile("prod", { url: "https://x.com", token: "t" }, { dir: tmpDir });

      const mode = statSync(join(tmpDir, "config.json")).mode & 0o777;
      expect(mode).toBe(0o600);

      const config = loadConfig(tmpDir);
      expect(config.profiles.prod).toEqual({ url: "https://x.com", token: "t" });
      expect(config.defaultProfile).toBe("prod");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
