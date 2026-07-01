import { describe, it, expect } from "vitest";
import { resolveCredentials, ConfigError } from "../src/config.ts";

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
