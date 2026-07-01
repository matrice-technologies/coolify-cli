// test/integration.test.ts
import { describe, it, expect } from "vitest";
import { ApiClient } from "../src/api/client.ts";
import { listResources } from "../src/api/resources.ts";

const live = process.env.COOLIFY_URL && process.env.COOLIFY_TOKEN;

describe.skipIf(!live)("integration (live)", () => {
  it("lists applications against a real instance", async () => {
    const client = new ApiClient({
      url: process.env.COOLIFY_URL!,
      token: process.env.COOLIFY_TOKEN!,
    });
    const apps = await listResources(client, "applications");
    expect(Array.isArray(apps)).toBe(true);
  });
});
