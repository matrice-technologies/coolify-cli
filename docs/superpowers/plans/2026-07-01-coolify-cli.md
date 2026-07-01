# Coolify CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a thin TypeScript CLI (`coolify`) that drives a self-hosted Coolify v4 instance's REST API for chat-driven CI/CD — deploy, env management, and resource inspection.

**Architecture:** Three layers. `api/client.ts` is the only HTTP-touching module (auth, base-URL joining, error mapping). `api/resources.ts` exposes typed functions over the client. `commands/*` implement CLI verbs against the resource layer and are unit-tested with a mocked client. `config.ts` resolves host+token from env vars or `~/.coolify/config.json` profiles. `commander` wires verbs in `bin.ts`.

**Tech Stack:** TypeScript, Node ≥ 20, `commander` (arg parsing), `tsx` (dev), `tsup` (build), `vitest` (tests). No runtime HTTP library — uses global `fetch` (Node 20+).

## Global Constraints

- Language: TypeScript, ESM (`"type": "module"`).
- Node ≥ 20 (relies on global `fetch`).
- Arg parser: `commander` only. No other CLI framework.
- HTTP only inside `src/api/client.ts`. Commands never call `fetch` directly.
- API base: `https://<host>/api/v1`, header `Authorization: Bearer <token>`.
- Config file `~/.coolify/config.json`, written with mode `0600`.
- Config resolution order: env vars (`COOLIFY_URL`/`COOLIFY_TOKEN`) → `--profile`/`COOLIFY_PROFILE` → `defaultProfile`.
- Test runner: `vitest`. TDD — failing test first, every task.
- Commit after every task.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/bin.ts`
- Test: `test/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable `tsx src/bin.ts` entry printing version; `vitest` runs.

- [ ] **Step 1: Write the failing test**

```ts
// test/smoke.test.ts
import { describe, it, expect } from "vitest";

describe("scaffold", () => {
  it("exports a version string", async () => {
    const { VERSION } = await import("../src/bin.ts");
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/smoke.test.ts`
Expected: FAIL — cannot resolve `../src/bin.ts`.

- [ ] **Step 3: Create config files and minimal entry**

`package.json`:
```json
{
  "name": "coolify-cli",
  "version": "0.1.0",
  "type": "module",
  "bin": { "coolify": "dist/bin.js" },
  "scripts": {
    "dev": "tsx src/bin.ts",
    "build": "tsup src/bin.ts --format esm --clean --dts=false",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": { "commander": "^12.1.0" },
  "devDependencies": {
    "tsx": "^4.19.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@types/node": "^20.16.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

`src/bin.ts`:
```ts
#!/usr/bin/env node
export const VERSION = "0.1.0";
```

- [ ] **Step 4: Install and run test to verify it passes**

Run: `npm install && npx vitest run test/smoke.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold coolify CLI project"
```

---

### Task 2: Config loader with profiles

**Files:**
- Create: `src/config.ts`
- Test: `test/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Credentials = { url: string; token: string }`
  - `type Config = { defaultProfile?: string; profiles: Record<string, Credentials> }`
  - `resolveCredentials(opts?: { profile?: string; env?: NodeJS.ProcessEnv; config?: Config }): Credentials` — applies resolution order; throws `ConfigError` if none found.
  - `loadConfig(dir?: string): Config` — reads `<dir>/config.json` (default `~/.coolify`), returns `{ profiles: {} }` if absent.
  - `saveProfile(name: string, creds: Credentials, opts?: { setDefault?: boolean; dir?: string }): void` — writes file with mode `0600`.
  - `class ConfigError extends Error`.

- [ ] **Step 1: Write the failing test**

```ts
// test/config.test.ts
import { describe, it, expect } from "vitest";
import { resolveCredentials, ConfigError } from "../src/config.ts";

describe("resolveCredentials", () => {
  it("prefers env vars", () => {
    const creds = resolveCredentials({
      env: { COOLIFY_URL: "https://e.com", COOLIFY_TOKEN: "t" },
      config: { profiles: {} },
    });
    expect(creds).toEqual({ url: "https://e.com", token: "t" });
  });

  it("falls back to named profile", () => {
    const creds = resolveCredentials({
      profile: "prod",
      env: {},
      config: { profiles: { prod: { url: "https://p.com", token: "p" } } },
    });
    expect(creds.url).toBe("https://p.com");
  });

  it("uses defaultProfile when no flag", () => {
    const creds = resolveCredentials({
      env: {},
      config: { defaultProfile: "prod", profiles: { prod: { url: "https://d.com", token: "d" } } },
    });
    expect(creds.token).toBe("d");
  });

  it("throws ConfigError when nothing resolves", () => {
    expect(() => resolveCredentials({ env: {}, config: { profiles: {} } })).toThrow(ConfigError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/config.test.ts`
Expected: FAIL — cannot resolve `../src/config.ts`.

- [ ] **Step 3: Implement config loader**

```ts
// src/config.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Credentials = { url: string; token: string };
export type Config = { defaultProfile?: string; profiles: Record<string, Credentials> };

export class ConfigError extends Error {}

function defaultDir(): string {
  return join(homedir(), ".coolify");
}

export function loadConfig(dir: string = defaultDir()): Config {
  const file = join(dir, "config.json");
  if (!existsSync(file)) return { profiles: {} };
  return JSON.parse(readFileSync(file, "utf8")) as Config;
}

export function saveProfile(
  name: string,
  creds: Credentials,
  opts: { setDefault?: boolean; dir?: string } = {},
): void {
  const dir = opts.dir ?? defaultDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const config = loadConfig(dir);
  config.profiles[name] = creds;
  if (opts.setDefault || !config.defaultProfile) config.defaultProfile = name;
  writeFileSync(join(dir, "config.json"), JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function resolveCredentials(
  opts: { profile?: string; env?: NodeJS.ProcessEnv; config?: Config } = {},
): Credentials {
  const env = opts.env ?? process.env;
  if (env.COOLIFY_URL && env.COOLIFY_TOKEN) {
    return { url: env.COOLIFY_URL, token: env.COOLIFY_TOKEN };
  }
  const config = opts.config ?? loadConfig();
  const name = opts.profile ?? env.COOLIFY_PROFILE ?? config.defaultProfile;
  if (name && config.profiles[name]) return config.profiles[name];
  throw new ConfigError(
    "No Coolify credentials found. Set COOLIFY_URL/COOLIFY_TOKEN or run `coolify config set`.",
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/config.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: config loader with profile resolution"
```

---

### Task 3: API client with error mapping

**Files:**
- Create: `src/api/client.ts`
- Test: `test/client.test.ts`

**Interfaces:**
- Consumes: `Credentials` from `src/config.ts`.
- Produces:
  - `class ApiClient { constructor(creds: Credentials, fetchImpl?: typeof fetch); request<T>(method: string, path: string, body?: unknown): Promise<T> }`
  - Error classes: `ApiError`, `AuthError`, `NotFoundError`, `ValidationError` (all extend `ApiError`, carry `.status` and API `.message`).
  - `request` joins base `<url>/api/v1` + `path`, sets `Authorization: Bearer`, `Content-Type: application/json`; parses JSON; maps 401/403→`AuthError`, 404→`NotFoundError`, 422→`ValidationError`, other non-2xx→`ApiError`.

- [ ] **Step 1: Write the failing test**

```ts
// test/client.test.ts
import { describe, it, expect } from "vitest";
import { ApiClient, AuthError, NotFoundError } from "../src/api/client.ts";

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

const creds = { url: "https://c.com", token: "t" };

describe("ApiClient", () => {
  it("returns parsed JSON on 200", async () => {
    const client = new ApiClient(creds, fakeFetch(200, { ok: true }));
    expect(await client.request("GET", "/applications")).toEqual({ ok: true });
  });

  it("builds the correct URL and auth header", async () => {
    let seenUrl = "";
    let seenAuth = "";
    const spy = (async (url: string, init: RequestInit) => {
      seenUrl = url;
      seenAuth = (init.headers as Record<string, string>)["Authorization"];
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    await new ApiClient(creds, spy).request("GET", "/applications");
    expect(seenUrl).toBe("https://c.com/api/v1/applications");
    expect(seenAuth).toBe("Bearer t");
  });

  it("maps 401 to AuthError", async () => {
    const client = new ApiClient(creds, fakeFetch(401, { message: "bad token" }));
    await expect(client.request("GET", "/x")).rejects.toBeInstanceOf(AuthError);
  });

  it("maps 404 to NotFoundError with message", async () => {
    const client = new ApiClient(creds, fakeFetch(404, { message: "gone" }));
    await expect(client.request("GET", "/x")).rejects.toThrow("gone");
    await expect(client.request("GET", "/x")).rejects.toBeInstanceOf(NotFoundError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/client.test.ts`
Expected: FAIL — cannot resolve `../src/api/client.ts`.

- [ ] **Step 3: Implement the client**

```ts
// src/api/client.ts
import type { Credentials } from "../config.ts";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export class AuthError extends ApiError {}
export class NotFoundError extends ApiError {}
export class ValidationError extends ApiError {}

export class ApiClient {
  private base: string;
  constructor(
    private creds: Credentials,
    private fetchImpl: typeof fetch = fetch,
  ) {
    this.base = creds.url.replace(/\/+$/, "") + "/api/v1";
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(this.base + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.creds.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const msg = (data && data.message) || `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) throw new AuthError(res.status, msg);
      if (res.status === 404) throw new NotFoundError(res.status, msg);
      if (res.status === 422) throw new ValidationError(res.status, msg);
      throw new ApiError(res.status, msg);
    }
    return data as T;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/client.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: API client with typed error mapping"
```

---

### Task 4: Resource layer

**Files:**
- Create: `src/api/resources.ts`
- Test: `test/resources.test.ts`

**Interfaces:**
- Consumes: `ApiClient` from `src/api/client.ts`.
- Produces (all take `client: ApiClient` as first arg):
  - `type Resource = { uuid: string; name: string; [k: string]: unknown }`
  - `type ResourceKind = "applications" | "services" | "databases" | "projects" | "servers"`
  - `listResources(client, kind: ResourceKind): Promise<Resource[]>`
  - `getApplication(client, uuid: string): Promise<Resource>`
  - `type EnvVar = { key: string; value: string; uuid?: string; [k: string]: unknown }`
  - `listEnvs(client, uuid: string): Promise<EnvVar[]>`
  - `setEnvsBulk(client, uuid: string, data: { key: string; value: string }[]): Promise<EnvVar[]>` — `PATCH /applications/{uuid}/envs/bulk`, body `{ data }`.
  - `setEnvSingle(client, uuid: string, key: string, value: string): Promise<void>` — `PATCH /applications/{uuid}/envs`, fallback used if bulk 404s.
  - `deleteEnv(client, uuid: string, key: string): Promise<void>`
  - `deploy(client, uuid: string, opts?: { force?: boolean }): Promise<{ deployments: { deployment_uuid: string }[] }>` — `GET /deploy?uuid=&force=`.
  - `getDeployment(client, deploymentUuid: string): Promise<{ status: string; [k: string]: unknown }>` — `GET /deployments/{uuid}`.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/resources.test.ts`
Expected: FAIL — cannot resolve `../src/api/resources.ts`.

- [ ] **Step 3: Implement resource functions**

```ts
// src/api/resources.ts
import { ApiClient, NotFoundError } from "./client.ts";

export type Resource = { uuid: string; name: string; [k: string]: unknown };
export type ResourceKind = "applications" | "services" | "databases" | "projects" | "servers";
export type EnvVar = { key: string; value: string; uuid?: string; [k: string]: unknown };

export function listResources(client: ApiClient, kind: ResourceKind): Promise<Resource[]> {
  return client.request<Resource[]>("GET", `/${kind}`);
}

export function getApplication(client: ApiClient, uuid: string): Promise<Resource> {
  return client.request<Resource>("GET", `/applications/${uuid}`);
}

export function listEnvs(client: ApiClient, uuid: string): Promise<EnvVar[]> {
  return client.request<EnvVar[]>("GET", `/applications/${uuid}/envs`);
}

export async function setEnvsBulk(
  client: ApiClient,
  uuid: string,
  data: { key: string; value: string }[],
): Promise<EnvVar[]> {
  try {
    return await client.request<EnvVar[]>("PATCH", `/applications/${uuid}/envs/bulk`, { data });
  } catch (err) {
    if (err instanceof NotFoundError) {
      // Fallback: loop single-var updates when bulk route is unavailable.
      for (const item of data) await setEnvSingle(client, uuid, item.key, item.value);
      return [];
    }
    throw err;
  }
}

export async function setEnvSingle(
  client: ApiClient,
  uuid: string,
  key: string,
  value: string,
): Promise<void> {
  await client.request("PATCH", `/applications/${uuid}/envs`, { key, value });
}

export async function deleteEnv(client: ApiClient, uuid: string, key: string): Promise<void> {
  await client.request("DELETE", `/applications/${uuid}/envs/${encodeURIComponent(key)}`);
}

export function deploy(
  client: ApiClient,
  uuid: string,
  opts: { force?: boolean } = {},
): Promise<{ deployments: { deployment_uuid: string }[] }> {
  const force = opts.force ? "&force=true" : "";
  return client.request("GET", `/deploy?uuid=${encodeURIComponent(uuid)}${force}`);
}

export function getDeployment(
  client: ApiClient,
  deploymentUuid: string,
): Promise<{ status: string; [k: string]: unknown }> {
  return client.request("GET", `/deployments/${deploymentUuid}`);
}
```

Note: the `deploy` test expects `force=true` to appear as `&force=true`; adjust the assertion to build `?uuid=u1&force=true` — the query already begins with `?uuid=`, so `force` uses `&`. Confirm the test path string matches `"/deploy?uuid=u1&force=true"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/resources.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: typed Coolify resource layer"
```

---

### Task 5: Name→UUID resolver

**Files:**
- Create: `src/util/resolve.ts`
- Test: `test/resolve.test.ts`

**Interfaces:**
- Consumes: `listResources`, `Resource`, `ResourceKind` from `src/api/resources.ts`; `ApiClient`.
- Produces:
  - `resolveUuid(client, kind: ResourceKind, nameOrUuid: string): Promise<string>` — if input looks like a UUID (matches `/^[0-9a-z]{16,}$/i` or contains a dash-uuid), return as-is; else list `kind` and match by exact `name`. Throw `ResolveError` on zero matches or multiple matches (message lists candidates).
  - `class ResolveError extends Error`.

- [ ] **Step 1: Write the failing test**

```ts
// test/resolve.test.ts
import { describe, it, expect, vi } from "vitest";
import { resolveUuid, ResolveError } from "../src/util/resolve.ts";
import * as resources from "../src/api/resources.ts";

const client = {} as any;

describe("resolveUuid", () => {
  it("passes through a uuid-looking string", async () => {
    expect(await resolveUuid(client, "applications", "abc123def4567890")).toBe("abc123def4567890");
  });

  it("resolves a unique name", async () => {
    vi.spyOn(resources, "listResources").mockResolvedValue([
      { uuid: "u1", name: "web" },
      { uuid: "u2", name: "api" },
    ]);
    expect(await resolveUuid(client, "applications", "api")).toBe("u2");
  });

  it("throws on unknown name", async () => {
    vi.spyOn(resources, "listResources").mockResolvedValue([{ uuid: "u1", name: "web" }]);
    await expect(resolveUuid(client, "applications", "nope")).rejects.toBeInstanceOf(ResolveError);
  });

  it("throws on ambiguous name", async () => {
    vi.spyOn(resources, "listResources").mockResolvedValue([
      { uuid: "u1", name: "web" },
      { uuid: "u2", name: "web" },
    ]);
    await expect(resolveUuid(client, "applications", "web")).rejects.toBeInstanceOf(ResolveError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/resolve.test.ts`
Expected: FAIL — cannot resolve `../src/util/resolve.ts`.

- [ ] **Step 3: Implement resolver**

```ts
// src/util/resolve.ts
import { ApiClient } from "../api/client.ts";
import { listResources, type ResourceKind } from "../api/resources.ts";

export class ResolveError extends Error {}

const UUID_LIKE = /^[0-9a-z]{16,}$/i;

export async function resolveUuid(
  client: ApiClient,
  kind: ResourceKind,
  nameOrUuid: string,
): Promise<string> {
  if (UUID_LIKE.test(nameOrUuid) || /^[0-9a-f-]{20,}$/i.test(nameOrUuid)) return nameOrUuid;
  const all = await listResources(client, kind);
  const matches = all.filter((r) => r.name === nameOrUuid);
  if (matches.length === 1) return matches[0].uuid;
  if (matches.length === 0) {
    throw new ResolveError(
      `No ${kind} named "${nameOrUuid}". Available: ${all.map((r) => r.name).join(", ") || "(none)"}`,
    );
  }
  throw new ResolveError(
    `Multiple ${kind} named "${nameOrUuid}": ${matches.map((r) => r.uuid).join(", ")}. Use a UUID.`,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/resolve.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: name-to-UUID resolver"
```

---

### Task 6: Output helpers

**Files:**
- Create: `src/util/output.ts`
- Test: `test/output.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `renderTable(rows: Record<string, unknown>[], columns: string[]): string` — fixed-width columns, header row, one line per row; empty input returns `"(none)"`.
  - `printResult(data: unknown, opts: { json?: boolean }, columns?: string[]): void` — if `opts.json`, `console.log(JSON.stringify(data, null, 2))`; else render table when array + columns provided, otherwise pretty-print.

- [ ] **Step 1: Write the failing test**

```ts
// test/output.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/output.test.ts`
Expected: FAIL — cannot resolve `../src/util/output.ts`.

- [ ] **Step 3: Implement output helpers**

```ts
// src/util/output.ts
export function renderTable(rows: Record<string, unknown>[], columns: string[]): string {
  if (rows.length === 0) return "(none)";
  const widths = columns.map((c) =>
    Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)),
  );
  const line = (cells: string[]) =>
    cells.map((cell, i) => cell.padEnd(widths[i])).join("  ").trimEnd();
  const header = line(columns);
  const body = rows.map((r) => line(columns.map((c) => String(r[c] ?? ""))));
  return [header, ...body].join("\n");
}

export function printResult(
  data: unknown,
  opts: { json?: boolean },
  columns?: string[],
): void {
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (Array.isArray(data) && columns) {
    console.log(renderTable(data as Record<string, unknown>[], columns));
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/output.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: table/json output helpers"
```

---

### Task 7: Deploy status watcher

**Files:**
- Create: `src/commands/deploy.ts`
- Test: `test/deploy-watch.test.ts`

**Interfaces:**
- Consumes: `getDeployment` from `src/api/resources.ts`; `ApiClient`.
- Produces:
  - `watchDeployment(client, deploymentUuid: string, opts?: { intervalMs?: number; onStatus?: (s: string) => void; maxPolls?: number }): Promise<"finished" | "failed">` — polls `getDeployment` until status is terminal. Success statuses: `finished`. Failure: `failed`, `error`, `cancelled`. Calls `onStatus` on each poll. Uses `intervalMs` (default 2000) between polls; `maxPolls` default 600.

- [ ] **Step 1: Write the failing test**

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/deploy-watch.test.ts`
Expected: FAIL — cannot resolve `../src/commands/deploy.ts`.

- [ ] **Step 3: Implement the watcher**

```ts
// src/commands/deploy.ts
import { ApiClient } from "../api/client.ts";
import { getDeployment } from "../api/resources.ts";

const SUCCESS = new Set(["finished"]);
const FAILURE = new Set(["failed", "error", "cancelled"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function watchDeployment(
  client: ApiClient,
  deploymentUuid: string,
  opts: { intervalMs?: number; onStatus?: (s: string) => void; maxPolls?: number } = {},
): Promise<"finished" | "failed"> {
  const interval = opts.intervalMs ?? 2000;
  const maxPolls = opts.maxPolls ?? 600;
  for (let n = 0; n < maxPolls; n++) {
    const { status } = await getDeployment(client, deploymentUuid);
    opts.onStatus?.(status);
    if (SUCCESS.has(status)) return "finished";
    if (FAILURE.has(status)) return "failed";
    await sleep(interval);
  }
  return "failed";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/deploy-watch.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: deploy status watcher"
```

---

### Task 8: CLI wiring (commander) + build

**Files:**
- Modify: `src/bin.ts`
- Create: `src/commands/config.ts`, `src/commands/list.ts`, `src/commands/env.ts`
- Test: `test/cli.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: a `buildProgram(): Command` function returning the configured commander program (exported for testing) plus a top-level run guard. Commands: `config set|use|ls`, `ls [kind]`, `inspect <target>`, `deploy <target>`, `env ls|set|rm`.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/cli.test.ts`
Expected: FAIL — `buildProgram` is not exported.

- [ ] **Step 3: Implement command modules and wiring**

`src/commands/config.ts`:
```ts
import { Command } from "commander";
import { saveProfile, loadConfig } from "../config.ts";
import { renderTable } from "../util/output.ts";

export function configCommand(): Command {
  const cmd = new Command("config").description("Manage Coolify profiles");

  cmd
    .command("set")
    .requiredOption("--profile <name>", "profile name")
    .requiredOption("--url <url>", "Coolify base URL")
    .requiredOption("--token <token>", "API token")
    .option("--default", "set as default profile", false)
    .action((o) => {
      saveProfile(o.profile, { url: o.url, token: o.token }, { setDefault: o.default });
      console.log(`Saved profile "${o.profile}".`);
    });

  cmd
    .command("use <name>")
    .action((name) => {
      const cfg = loadConfig();
      if (!cfg.profiles[name]) throw new Error(`No profile "${name}".`);
      saveProfile(name, cfg.profiles[name], { setDefault: true });
      console.log(`Default profile is now "${name}".`);
    });

  cmd.command("ls").action(() => {
    const cfg = loadConfig();
    const rows = Object.entries(cfg.profiles).map(([name, c]) => ({
      name,
      url: c.url,
      default: name === cfg.defaultProfile ? "*" : "",
    }));
    console.log(renderTable(rows, ["name", "url", "default"]));
  });

  return cmd;
}
```

`src/commands/list.ts`:
```ts
import { Command } from "commander";
import { ApiClient } from "../api/client.ts";
import { resolveCredentials } from "../config.ts";
import { listResources, getApplication, type ResourceKind } from "../api/resources.ts";
import { resolveUuid } from "../util/resolve.ts";
import { printResult } from "../util/output.ts";

function clientFor(profile?: string): ApiClient {
  return new ApiClient(resolveCredentials({ profile }));
}

export function lsCommand(): Command {
  return new Command("ls")
    .argument("[kind]", "applications|services|databases|projects|servers", "applications")
    .option("--profile <name>", "profile to use")
    .option("--json", "output JSON", false)
    .action((kind: ResourceKind, o) => {
      return listResources(clientFor(o.profile), kind).then((rows) =>
        printResult(rows, { json: o.json }, ["name", "uuid"]),
      );
    });
}

export function inspectCommand(): Command {
  return new Command("inspect")
    .argument("<target>", "app name or uuid")
    .option("--profile <name>", "profile to use")
    .option("--json", "output JSON", false)
    .action(async (target: string, o) => {
      const client = clientFor(o.profile);
      const uuid = await resolveUuid(client, "applications", target);
      printResult(await getApplication(client, uuid), { json: o.json });
    });
}
```

`src/commands/env.ts`:
```ts
import { Command } from "commander";
import { ApiClient } from "../api/client.ts";
import { resolveCredentials } from "../config.ts";
import { listEnvs, setEnvsBulk, deleteEnv, deploy } from "../api/resources.ts";
import { resolveUuid } from "../util/resolve.ts";
import { printResult } from "../util/output.ts";
import { watchDeployment } from "./deploy.ts";

function clientFor(profile?: string): ApiClient {
  return new ApiClient(resolveCredentials({ profile }));
}

export function envCommand(): Command {
  const cmd = new Command("env").description("Manage application environment variables");

  cmd
    .command("ls <app>")
    .option("--profile <name>", "profile to use")
    .option("--json", "output JSON", false)
    .action(async (app: string, o) => {
      const client = clientFor(o.profile);
      const uuid = await resolveUuid(client, "applications", app);
      printResult(await listEnvs(client, uuid), { json: o.json }, ["key", "value"]);
    });

  cmd
    .command("set <app> [pairs...]")
    .option("--profile <name>", "profile to use")
    .option("--redeploy", "deploy after setting", false)
    .action(async (app: string, pairs: string[], o) => {
      const client = clientFor(o.profile);
      const uuid = await resolveUuid(client, "applications", app);
      const data = pairs.map((p) => {
        const eq = p.indexOf("=");
        if (eq < 0) throw new Error(`Invalid pair "${p}", expected KEY=VALUE`);
        return { key: p.slice(0, eq), value: p.slice(eq + 1) };
      });
      await setEnvsBulk(client, uuid, data);
      console.log(`Set ${data.length} variable(s).`);
      if (o.redeploy) {
        const res = await deploy(client, uuid);
        const dep = res.deployments[0]?.deployment_uuid;
        if (dep) await watchDeployment(client, dep, { onStatus: (s) => console.log(`  ${s}`) });
      }
    });

  cmd
    .command("rm <app> <key>")
    .option("--profile <name>", "profile to use")
    .action(async (app: string, key: string, o) => {
      const client = clientFor(o.profile);
      const uuid = await resolveUuid(client, "applications", app);
      await deleteEnv(client, uuid, key);
      console.log(`Removed ${key}.`);
    });

  return cmd;
}
```

`src/bin.ts` (replace file):
```ts
#!/usr/bin/env node
import { Command } from "commander";
import { ApiClient } from "./api/client.ts";
import { resolveCredentials } from "./config.ts";
import { deploy } from "./api/resources.ts";
import { resolveUuid } from "./util/resolve.ts";
import { watchDeployment } from "./commands/deploy.ts";
import { configCommand } from "./commands/config.ts";
import { lsCommand, inspectCommand } from "./commands/list.ts";
import { envCommand } from "./commands/env.ts";

export const VERSION = "0.1.0";

export function buildProgram(): Command {
  const program = new Command("coolify").version(VERSION);
  program.addCommand(configCommand());
  program.addCommand(lsCommand());
  program.addCommand(inspectCommand());
  program.addCommand(envCommand());

  program
    .command("deploy <target>")
    .option("--profile <name>", "profile to use")
    .option("--force", "force rebuild", false)
    .option("--no-watch", "do not wait for completion")
    .action(async (target: string, o) => {
      const client = new ApiClient(resolveCredentials({ profile: o.profile }));
      const uuid = await resolveUuid(client, "applications", target);
      const res = await deploy(client, uuid, { force: o.force });
      const dep = res.deployments[0]?.deployment_uuid;
      console.log(`Triggered deploy ${dep ?? "(unknown)"}.`);
      if (o.watch && dep) {
        const result = await watchDeployment(client, dep, { onStatus: (s) => console.log(`  ${s}`) });
        if (result === "failed") {
          console.error("Deploy failed.");
          process.exitCode = 1;
        } else {
          console.log("Deploy finished.");
        }
      }
    });

  return program;
}

async function main() {
  try {
    await buildProgram().parseAsync(process.argv);
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  }
}

// Run only when invoked directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS — all suites (scaffold, config, client, resources, resolve, output, deploy-watch, cli).

- [ ] **Step 5: Verify the built binary runs**

Run: `npm run build && node dist/bin.js --help`
Expected: help text listing `config`, `ls`, `inspect`, `deploy`, `env`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire commander CLI (config, ls, inspect, deploy, env)"
```

---

### Task 9: README + integration smoke test

**Files:**
- Create: `README.md`, `test/integration.test.ts`

**Interfaces:**
- Consumes: full CLI.
- Produces: usage docs; one live smoke test skipped unless `COOLIFY_URL`/`COOLIFY_TOKEN` are set.

- [ ] **Step 1: Write the integration smoke test**

```ts
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
```

- [ ] **Step 2: Run the suite (smoke test skips without creds)**

Run: `npx vitest run test/integration.test.ts`
Expected: PASS with the test reported as skipped.

- [ ] **Step 3: Write the README**

```markdown
# coolify-cli

Thin CLI for driving a self-hosted Coolify v4 instance (deploy, env, inspect).

## Install

    npm install && npm run build && npm link

## Configure

    coolify config set --profile prod --url https://coolify.example.com --token <API_TOKEN> --default

Or use env vars (win over profiles): `COOLIFY_URL`, `COOLIFY_TOKEN`.

## Commands

    coolify ls [applications|services|databases|projects|servers]
    coolify inspect <name|uuid>
    coolify deploy <name|uuid> [--force] [--no-watch]
    coolify env ls <app>
    coolify env set <app> KEY=VAL [KEY=VAL ...] [--redeploy]
    coolify env rm <app> <key>

Add `--json` to read commands for machine output; `--profile <name>` to target a profile.
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: README and live integration smoke test"
```

---

## Self-Review Notes

- **Spec coverage:** config/profiles (Task 2), resolution order (Task 2), client + error mapping (Task 3), resource endpoints incl. bulk-env fallback (Task 4), name resolution (Task 5), output/`--json` (Task 6), deploy watch + exit codes (Tasks 7–8), all v1 commands (Task 8), unit + integration tests (Tasks 1–9). Deferred items (logs, create, restart) intentionally absent.
- **Bulk-env unknown:** Task 4 wraps the bulk PATCH in a `NotFoundError` fallback to single-var updates, matching the spec's flagged uncertainty — no live confirmation needed to ship.
- **Type consistency:** `resolveCredentials`, `ApiClient.request`, `listResources`, `resolveUuid`, `watchDeployment`, `deploy` signatures are used identically across tasks.
