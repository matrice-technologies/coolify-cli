// test/deploy-outcome.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { reportDeployOutcome } from "../src/commands/deploy.ts";

describe("reportDeployOutcome", () => {
  const original = process.exitCode;
  afterEach(() => {
    process.exitCode = original;
    vi.restoreAllMocks();
  });

  it("prints finished and does not set exit code", () => {
    process.exitCode = undefined;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    reportDeployOutcome("finished", "web");
    expect(log).toHaveBeenCalledWith("Deploy finished.");
    expect(process.exitCode).toBeUndefined();
  });

  it("prints failed and sets exit code 1", () => {
    process.exitCode = undefined;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    reportDeployOutcome("failed", "web");
    expect(err).toHaveBeenCalledWith("Deploy failed.");
    expect(process.exitCode).toBe(1);
  });

  it("prints timeout hint with label and sets exit code 1", () => {
    process.exitCode = undefined;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    reportDeployOutcome("timeout", "web");
    expect(err).toHaveBeenCalledWith(
      "Deploy still running; check status with `coolify inspect web`.",
    );
    expect(process.exitCode).toBe(1);
  });

  it("honors a custom timeout hint", () => {
    process.exitCode = undefined;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    reportDeployOutcome("timeout", "api", "Deploy still running after polling");
    expect(err).toHaveBeenCalledWith(
      "Deploy still running after polling; check status with `coolify inspect api`.",
    );
    expect(process.exitCode).toBe(1);
  });
});
