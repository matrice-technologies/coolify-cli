// test/resolve.test.ts
import { describe, it, expect, vi } from "vitest";
import { resolveUuid, ResolveError } from "../src/util/resolve.ts";
import * as resources from "../src/api/resources.ts";

const client = {} as any;

describe("resolveUuid", () => {
  it("passes through a uuid-looking string", async () => {
    expect(await resolveUuid(client, "applications", "abc123def4567890")).toBe("abc123def4567890");
  });

  it("resolves a unique name", async () => {
    vi.spyOn(resources, "listResources").mockResolvedValue([
      { uuid: "u1", name: "web" },
      { uuid: "u2", name: "api" },
    ]);
    expect(await resolveUuid(client, "applications", "api")).toBe("u2");
  });

  it("throws on unknown name", async () => {
    vi.spyOn(resources, "listResources").mockResolvedValue([{ uuid: "u1", name: "web" }]);
    await expect(resolveUuid(client, "applications", "nope")).rejects.toBeInstanceOf(ResolveError);
  });

  it("throws on ambiguous name", async () => {
    vi.spyOn(resources, "listResources").mockResolvedValue([
      { uuid: "u1", name: "web" },
      { uuid: "u2", name: "web" },
    ]);
    await expect(resolveUuid(client, "applications", "web")).rejects.toBeInstanceOf(ResolveError);
  });
});
