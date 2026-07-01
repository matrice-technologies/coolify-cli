// test/resources.test.ts
import { describe, it, expect, vi } from "vitest";
import { listResources, deploy, setEnvsBulk } from "../src/api/resources.ts";
import { ApiClient } from "../src/api/client.ts";

function clientWith(request: (m: string, p: string, b?: unknown) => Promise<unknown>) {
  return { request: vi.fn(request) } as unknown as ApiClient;
}

describe("resource layer", () => {
  it("listResources calls the kind path", async () => {
    const client = clientWith(async () => [{ uuid: "u1", name: "app" }]);
    const out = await listResources(client, "applications");
    expect(out[0].name).toBe("app");
    expect((client.request as any)).toHaveBeenCalledWith("GET", "/applications");
  });

  it("deploy issues GET /deploy with uuid and force", async () => {
    let path = "";
    const client = clientWith(async (_m, p) => {
      path = p;
      return { deployments: [{ deployment_uuid: "d1" }] };
    });
    const out = await deploy(client, "u1", { force: true });
    expect(path).toBe("/deploy?uuid=u1&force=true");
    expect(out.deployments[0].deployment_uuid).toBe("d1");
  });

  it("setEnvsBulk PATCHes the bulk path with data envelope", async () => {
    let body: any;
    const client = clientWith(async (_m, _p, b) => {
      body = b;
      return [];
    });
    await setEnvsBulk(client, "u1", [{ key: "K", value: "V" }]);
    expect(body).toEqual({ data: [{ key: "K", value: "V" }] });
  });
});
