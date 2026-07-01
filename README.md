# coolify-cli

Thin CLI for driving a self-hosted Coolify v4 instance (deploy, env, inspect).

## Install

    npm install && npm run build && npm link

## Configure

    coolify config set --profile prod --url https://coolify.example.com --token <API_TOKEN> --default

Or use env vars (win over profiles): `COOLIFY_URL`, `COOLIFY_TOKEN`. When
`--profile` isn't passed, `COOLIFY_PROFILE` selects which stored profile to use.

## Commands

    coolify config set --profile <name> --url <url> --token <token> [--default]
    coolify config use <name>            # set the default profile
    coolify config ls                    # list profiles (tokens masked)
    coolify ls [applications|services|databases|projects|servers]
    coolify inspect <name|uuid>
    coolify deploy <name|uuid> [--force] [--no-watch]
    coolify env ls <app>
    coolify env set <app> KEY=VAL [KEY=VAL ...] [--redeploy]
    coolify env rm <app> <key>

`coolify ls` also accepts aliases like `apps`, `service`, `db`, `project`, `server`.

Add `--json` to read commands for machine output; `--profile <name>` to target a profile.
