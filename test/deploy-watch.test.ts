// test/deploy-watch.test.ts
import { describe, it, expect, vi } from "vitest";
import { watchDeployment } from "../src/commands/deploy.ts";
import * as resources from "../src/api/resources.ts";

describe("watchDeployment", () => {
  it("resolves finished after transient statuses", async () => {
    const seq = ["in_progress", "in_progress", "finished"];
    let i = 0;
    vi.spyOn(resources, "getDeployment").mockImplementation(async () => ({ status: seq[i++] }));
    const seen: string[] = [];
    const result = await watchDeployment({} as any, "d1", {
      intervalMs: 0,
      onStatus: (s) => seen.push(s),
    });
    expect(result).toBe("finished");
    expect(seen).toEqual(["in_progress", "in_progress", "finished"]);
  });

  it("resolves failed on error status", async () => {
    vi.spyOn(resources, "getDeployment").mockResolvedValue({ status: "failed" });
    const result = await watchDeployment({} as any, "d1", { intervalMs: 0 });
    expect(result).toBe("failed");
  });

  it("resolves failed on error status value", async () => {
    vi.spyOn(resources, "getDeployment").mockResolvedValue({ status: "error" });
    const result = await watchDeployment({} as any, "d1", { intervalMs: 0 });
    expect(result).toBe("failed");
  });

  it("resolves failed on cancelled status", async () => {
    vi.spyOn(resources, "getDeployment").mockResolvedValue({ status: "cancelled" });
    const result = await watchDeployment({} as any, "d1", { intervalMs: 0 });
    expect(result).toBe("failed");
  });

  it("resolves failed when maxPolls is exhausted without a terminal status", async () => {
    const spy = vi
      .spyOn(resources, "getDeployment")
      .mockResolvedValue({ status: "in_progress" });
    const result = await watchDeployment({} as any, "d1", { intervalMs: 0, maxPolls: 3 });
    expect(result).toBe("failed");
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
