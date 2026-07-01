import { describe, it, expect } from "vitest";
import { renderTable } from "../src/util/output.ts";

describe("renderTable", () => {
  it("renders header and rows", () => {
    const out = renderTable([{ name: "web", uuid: "u1" }], ["name", "uuid"]);
    expect(out).toContain("name");
    expect(out).toContain("web");
    expect(out).toContain("u1");
  });

  it("returns (none) for empty", () => {
    expect(renderTable([], ["name"])).toBe("(none)");
  });
});
