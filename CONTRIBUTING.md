# Contributing to Advocatra MCP

<!-- SPDX-License-Identifier: AGPL-3.0-only -->

Advocatra MCP is licensed under `AGPL-3.0-only`. Outside contributions
require the [Contributor License Agreement](CLA.md), confirmed through the
CLA Assistant check on your pull request.

## Before you start

- Read [`CLAUDE.md`](CLAUDE.md) first — this repo has a non-negotiable
  safety rule (read-only, PII-redacted) that every change must preserve.
- `git submodule update --init` after cloning — `vendor/advocatra` is a
  submodule, not vendored source.

## Local checks

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm check:no-write-tools
```

## Pull requests

- One branch, one small PR, squash merge. Never push to `main`.
- Add the SPDX header to every file you create.
- Never commit secrets, vault keys, session tokens, or any real taxpayer/
  client data.
- **Never add a tool that writes, deletes or mutates anything.** This repo
  exists specifically because that capability is deliberately absent — see
  `CLAUDE.md`.

## Reporting security issues

Do not open a public issue for a vulnerability. Contact the owner privately
via the GitHub account `johnarleyburns`.
