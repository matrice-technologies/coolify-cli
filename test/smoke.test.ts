import { describe, it, expect } from "vitest";

describe("scaffold", () => {
  it("exports a version string", async () => {
    const { VERSION } = await import("../src/bin.ts");
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
