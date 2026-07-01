// test/list-kind.test.ts
import { describe, it, expect } from "vitest";
import { normalizeKind } from "../src/commands/list.ts";

describe("normalizeKind", () => {
  it("passes canonical kinds through", () => {
    expect(normalizeKind("applications")).toBe("applications");
    expect(normalizeKind("servers")).toBe("servers");
  });

  it("maps aliases to canonical kinds", () => {
    expect(normalizeKind("app")).toBe("applications");
    expect(normalizeKind("apps")).toBe("applications");
    expect(normalizeKind("service")).toBe("services");
    expect(normalizeKind("db")).toBe("databases");
    expect(normalizeKind("database")).toBe("databases");
    expect(normalizeKind("project")).toBe("projects");
    expect(normalizeKind("server")).toBe("servers");
  });

  it("throws a friendly error on an unknown kind", () => {
    expect(() => normalizeKind("foo")).toThrow(
      'Unknown kind "foo". Valid: applications, services, databases, projects, servers',
    );
  });
});
