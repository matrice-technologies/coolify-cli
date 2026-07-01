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
