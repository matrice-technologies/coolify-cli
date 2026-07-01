import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, symlinkSync, rmSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isMainModule } from "../src/bin.ts";

const cleanups: string[] = [];
afterEach(() => {
  for (const p of cleanups.splice(0)) rmSync(p, { recursive: true, force: true });
});

describe("isMainModule", () => {
  it("returns false when argv[1] is undefined (imported, not run)", () => {
    expect(isMainModule("file:///whatever.js", undefined)).toBe(false);
  });

  it("returns true when metaUrl matches the real path of argv[1]", () => {
    const dir = mkdtempSync(join(tmpdir(), "coolify-main-"));
    cleanups.push(dir);
    const real = join(dir, "bin.js");
    writeFileSync(real, "// entry");
    // Node reports import.meta.url as the symlink-resolved real path.
    const metaUrl = pathToFileURL(realpathSync(real)).href;
    expect(isMainModule(metaUrl, real)).toBe(true);
  });

  it("returns true when argv[1] is a symlink to the real module (npm link case)", () => {
    const dir = mkdtempSync(join(tmpdir(), "coolify-main-"));
    cleanups.push(dir);
    const real = join(dir, "bin.js");
    const link = join(dir, "coolify");
    writeFileSync(real, "// entry");
    symlinkSync(real, link);
    // metaUrl is the resolved real path (as Node reports import.meta.url),
    // argv[1] is the symlink the user invoked — must still match.
    const metaUrl = pathToFileURL(realpathSync(real)).href;
    expect(isMainModule(metaUrl, link)).toBe(true);
  });

  it("returns false when metaUrl does not match argv[1]", () => {
    const dir = mkdtempSync(join(tmpdir(), "coolify-main-"));
    cleanups.push(dir);
    const real = join(dir, "bin.js");
    writeFileSync(real, "// entry");
    expect(isMainModule("file:///some/other/module.js", real)).toBe(false);
  });

  it("returns false when argv[1] does not exist on disk", () => {
    expect(isMainModule("file:///whatever.js", "/no/such/path/bin.js")).toBe(false);
  });
});
