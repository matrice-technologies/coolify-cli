# Coolify CLI — Design

**Date:** 2026-07-01
**Status:** Approved (design), pending implementation plan

## Purpose

A thin, TypeScript command-line tool for driving a self-hosted Coolify
instance programmatically — primarily to run chat-driven CI/CD (deploy, manage
env vars, inspect resources) the way we currently use the Vercel CLI. It wraps
Coolify's v4 REST API. It is deliberately *not* a full mirror of Coolify's
UI/API; it covers only the operations our deploy workflow actually uses and
grows on demand.

## Non-goals (deferred, YAGNI)

Logs, resource creation (services/databases), restart/stop/start, preview/PR
deploys, and webhooks are explicitly out of v1. The resource layer is designed
so each of these is a one-function addition later.

## Architecture

Three layers so each piece is testable in isolation:

```
src/
  bin.ts              # entry; wires arg parser -> commands
  config.ts           # load/resolve ~/.coolify/config.json + profiles
  api/client.ts       # thin fetch wrapper: auth, base URL, error mapping
  api/resources.ts    # typed functions: listApps, deploy, getDeployment, updateEnvs...
  commands/
    config.ts         # coolify config set/use/ls
    list.ts           # coolify ls
    inspect.ts        # coolify inspect
    deploy.ts         # coolify deploy (+ status polling)
    env.ts            # coolify env ls/set/rm
  util/resolve.ts     # resolve app name -> UUID via list
  util/output.ts      # table / json / spinner formatting
```

- `api/client.ts` is the **only** module that performs HTTP. Everything else
  calls typed functions, so commands can be unit-tested against a mocked client.
- **Arg parser:** `commander` (battle-tested, tiny, strong TS types).
- Build with `tsup` to a `bin`; `tsx` for dev; exposed via `package.json`
  `bin` field so `npm link` / `npx` works.

## Config & profiles

File: `~/.coolify/config.json`, created with mode `600`. Independent of any
project's git.

```json
{
  "defaultProfile": "prod",
  "profiles": {
    "prod": { "url": "https://coolify.example.com", "token": "<api-token>" }
  }
}
```

Resolution order for host + token on any command:

1. `COOLIFY_URL` / `COOLIFY_TOKEN` environment variables (win if set — for CI)
2. Profile selected by `--profile <name>` flag or `COOLIFY_PROFILE` env var
3. `defaultProfile` from the config file

`coolify config set --profile prod --url … --token …` writes/updates a profile.
`coolify config use <name>` sets the default. `coolify config ls` lists profiles
(tokens masked).

## v1 commands

| Command | Behavior |
|---|---|
| `coolify config set/use/ls` | Manage profiles (see above). |
| `coolify ls [projects\|apps\|services\|servers]` | List resources with **name + UUID**. Default target: `apps`. |
| `coolify inspect <name\|uuid>` | Full details of one resource. |
| `coolify deploy <name\|uuid> [--force] [--no-watch]` | Trigger deploy; by default polls `/deployments/{uuid}` and streams status until success/failure. Exits non-zero on failed deploy. |
| `coolify env ls <app>` | List env vars for an app. |
| `coolify env set <app> KEY=VAL [KEY=VAL…] [--redeploy]` | Upsert vars via the bulk env endpoint; optional redeploy after. |
| `coolify env rm <app> KEY` | Remove a var. |

**Name resolution** (`util/resolve.ts`): every command accepts either a UUID or
a human-readable name. Names are resolved to UUIDs via a (per-invocation cached)
list call. This is what makes the tool feel like `vercel` rather than raw
`curl` — you rarely paste UUIDs. Ambiguous names (same name across projects)
produce an error listing the candidates.

## Coolify v4 API endpoints used

Base: `https://<host>/api/v1`, `Authorization: Bearer <token>`.

- `GET/POST /deploy?uuid=<uuid>&force=<bool>` — trigger deploy; returns
  deployment UUID(s).
- `GET /deployments/{uuid}` — deployment status (polled during `--watch`).
- `GET /applications` | `/services` | `/databases` | `/projects` | `/servers` —
  list resources.
- `GET /applications/{uuid}` — resource detail (for `inspect`).
- `GET /applications/{uuid}/envs` — list env vars.
- `PATCH /applications/{uuid}/envs/bulk` — bulk upsert env vars
  (`{ data: [{ key, value, is_literal, is_multiline, ... }] }`).
- `PATCH /applications/{uuid}/envs` — update a single env var (fallback).

## Error handling & output

- `api/client.ts` maps non-2xx responses to typed errors: `AuthError` (401/403),
  `NotFoundError` (404), `ValidationError` (422), and a generic `ApiError`,
  each surfacing the API's own `message`.
- Read commands accept `--json` for machine-readable output; default is a clean
  table via `util/output.ts`.
- `deploy` prints a live status line while watching and exits `0` on success /
  `1` on failure, so it is CI-friendly.

## Testing

- **Unit (Vitest):**
  - `api/client.ts` — auth header construction, base-URL joining, error mapping.
  - Command logic — run against a mocked client; assert correct resource calls
    and exit behavior (esp. `deploy` success/failure exit codes and name
    resolution).
- **Integration smoke test:** one test gated behind real `COOLIFY_URL` /
  `COOLIFY_TOKEN` env vars (skipped when unset) that runs `ls` against a live
  instance to prove end-to-end connectivity.

## Tooling / packaging

- Language: TypeScript (Node).
- Arg parsing: `commander`.
- Dev run: `tsx`. Build: `tsup` → `dist/bin.js` with a shebang.
- `package.json` `bin: { "coolify": "dist/bin.js" }`; installable via
  `npm link` / `npx`.
- Tests: `vitest`.
