<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Advocatra MCP

A local, **read-only** MCP server for [Advocatra](https://github.com/johnarleyburns/advocatra),
so Claude/opencode running on your own machine can answer questions about
clients, matters, tasks and deadlines — without ever sending real names,
SSNs/EINs, addresses, phone numbers or emails to the model, and without any
ability to create, edit, or delete anything.

## Architecture in one sentence

This server runs **locally, next to your own Claude/opencode**, logs into
your Advocatra tenant the same way a browser would, downloads the
encrypted snapshot, and decrypts it **in this process, on your machine**.
The cloud never holds a decryption key and never sees plaintext — this
server doesn't change that, it just adds one more local, decrypting client
to the list (alongside the native apps and the web browser).

## Status

Working end-to-end against a vault built with `@advocatra/vault`'s
`createVault`, with 9 read-only tools (`list_taxpayers`, `get_taxpayer`,
`list_matters`, `list_tasks`, `get_upcoming_deadlines`,
`list_correspondence`, `list_documents`, `list_activity`, `search`), all
PII-redacted per the policy in [`CLAUDE.md`](CLAUDE.md).

**Known gap, not yet closed**: there is no HTTP endpoint anywhere in
`advocatra` yet that stores or serves a vault's manifest — no server-side
"create a vault" flow exists. Until that's built, this server accepts an
already-unwrapped vault master key directly from a local file, not a
passphrase. See `CLAUDE.md`'s "Status" section for the exact mechanism and
what it's waiting on.

## Setup

```sh
git clone --recurse-submodules https://github.com/johnarleyburns/advocatra-mcp.git
cd advocatra-mcp
pnpm install
```

Configure via environment variables (set these in your MCP host's config,
e.g. Claude Desktop's `mcpServers` entry — never in a committed file):

| Variable | Purpose |
| --- | --- |
| `ADVOCATRA_TENANT_HOST` | e.g. `janedoe.advocatra.com` |
| `ADVOCATRA_EMAIL` / `ADVOCATRA_PASSWORD` | your Advocatra login |
| `ADVOCATRA_TOTP_CODE` | if your account has 2FA enabled |
| `ADVOCATRA_VAULT_ID` | your tenant id |
| `ADVOCATRA_VAULT_KEY_FILE` | path to a local file holding the base64 vault master key (see the gap above) |

```sh
pnpm start
```

## Local development

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm check:no-write-tools   # fails if any file imports a write/encrypt/upload-capable function
```
