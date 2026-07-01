// test/cli.test.ts
import { describe, it, expect } from "vitest";
import { buildProgram } from "../src/bin.ts";

describe("buildProgram", () => {
  it("registers the core commands", () => {
    const program = buildProgram();
    const names = program.commands.map((c) => c.name());
    expect(names).toEqual(expect.arrayContaining(["config", "ls", "inspect", "deploy", "env"]));
  });

  it("deploy has a --force and --no-watch option", () => {
    const deploy = buildProgram().commands.find((c) => c.name() === "deploy")!;
    const opts = deploy.options.map((o) => o.long);
    expect(opts).toEqual(expect.arrayContaining(["--force", "--no-watch"]));
  });
});
