// test/resources.test.ts
import { describe, it, expect, vi } from "vitest";
import { listResources, deploy, setEnvsBulk, deleteEnv } from "../src/api/resources.ts";
import { ApiClient, NotFoundError, ValidationError } from "../src/api/client.ts";

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

  it("setEnvsBulk falls back to single-env PATCHes on NotFoundError", async () => {
    const client = clientWith(async (_m, p) => {
      if (p.includes("/bulk")) throw new NotFoundError(404, "no bulk route");
      return undefined;
    });
    const out = await setEnvsBulk(client, "u1", [
      { key: "A", value: "1" },
      { key: "B", value: "2" },
    ]);
    expect(out).toEqual([]);

    const calls = (client.request as any).mock.calls;
    // First call is the bulk PATCH, then one single PATCH per var.
    expect(calls).toHaveLength(3);
    expect(calls[0][0]).toBe("PATCH");
    expect(calls[0][1]).toBe("/applications/u1/envs/bulk");
    expect(calls[1]).toEqual(["PATCH", "/applications/u1/envs", { key: "A", value: "1" }]);
    expect(calls[2]).toEqual(["PATCH", "/applications/u1/envs", { key: "B", value: "2" }]);
  });

  it("setEnvsBulk propagates non-NotFoundError errors", async () => {
    const client = clientWith(async (_m, p) => {
      if (p.includes("/bulk")) throw new ValidationError(422, "bad");
      return undefined;
    });
    await expect(
      setEnvsBulk(client, "u1", [{ key: "A", value: "1" }]),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("deleteEnv resolves the key to its uuid and DELETEs by uuid (not by key)", async () => {
    const client = clientWith(async (m, p) => {
      if (m === "GET" && p === "/applications/u1/envs") {
        return [{ key: "K", value: "V", uuid: "e1" }];
      }
      return undefined;
    });
    const count = await deleteEnv(client, "u1", "K");
    expect(count).toBe(1);

    const calls = (client.request as any).mock.calls;
    expect(calls).toContainEqual(["GET", "/applications/u1/envs"]);
    expect(calls).toContainEqual(["DELETE", "/applications/u1/envs/e1"]);
    // Regression guard for the original bug: must never DELETE by key name.
    expect(calls).not.toContainEqual(["DELETE", "/applications/u1/envs/K"]);
  });

  it("deleteEnv deletes every match when a key exists as production and preview", async () => {
    const deleted: string[] = [];
    const client = clientWith(async (m, p) => {
      if (m === "GET") {
        return [
          { key: "K", value: "V", uuid: "e-prod", is_preview: false },
          { key: "K", value: "V", uuid: "e-prev", is_preview: true },
          { key: "OTHER", value: "x", uuid: "e-other" },
        ];
      }
      if (m === "DELETE") deleted.push(p);
      return undefined;
    });
    const count = await deleteEnv(client, "u1", "K");
    expect(count).toBe(2);
    expect(deleted).toEqual([
      "/applications/u1/envs/e-prod",
      "/applications/u1/envs/e-prev",
    ]);
  });

  it("deleteEnv throws a clear error and deletes nothing when the key is absent", async () => {
    const client = clientWith(async (m) => {
      if (m === "GET") return [{ key: "OTHER", value: "x", uuid: "e1" }];
      return undefined;
    });
    await expect(deleteEnv(client, "u1", "MISSING")).rejects.toThrow(/MISSING/);
    const calls = (client.request as any).mock.calls;
    expect(calls.some((c: any[]) => c[0] === "DELETE")).toBe(false);
  });

  it("deleteEnv refuses to delete a match lacking a uuid (never sends a non-uuid path)", async () => {
    const client = clientWith(async (m) => {
      if (m === "GET") return [{ key: "K", value: "V" }]; // no uuid field
      return undefined;
    });
    await expect(deleteEnv(client, "u1", "K")).rejects.toThrow(/uuid/i);
    const calls = (client.request as any).mock.calls;
    expect(calls.some((c: any[]) => c[0] === "DELETE")).toBe(false);
  });
});
