<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# CLAUDE.md — Advocatra MCP (`johnarleyburns/advocatra-mcp`)

A local MCP server so Claude/opencode, running on the owner's own machine,
can answer questions about Advocatra clients, matters, tasks and
deadlines. Two non-negotiable rules, by explicit owner requirement, both
enforced mechanically, not just documented:

1. **Read-only. No tool here may create, edit, or delete anything, ever.**
2. **No real PII reaches the LLM.** Names, SSNs/EINs (beyond last-4),
   addresses, phones and emails are redacted or omitted before any tool
   returns a value; free-text fields get a best-effort local regex scrub.

## Source of truth

1. This file.
2. `vendor/advocatra/docs/architecture/TECHNICAL-DESIGN.md` (the submodule)
   — the canonical case/billing schema and encryption model this server
   consumes. Never invent a field or redaction rule not derived from the
   real schema there.
3. The GitHub issue being worked.

## Architecture

- **This server is a local decrypting client — the same trust tier as a
  native app or a browser tab, not a cloud service.** It logs into the
  tenant's Vault DO exactly like a browser would (`cloud-client.ts`),
  downloads the encrypted snapshot (`GET /vault/snapshot` — the only
  network call this server ever makes besides login), and decrypts it in
  this process (`vault-session.ts`), using `@advocatra/vault`'s
  `decryptVaultSnapshot`. The cloud never holds a key; this server doesn't
  change that.
- **Dependency wiring**: `vendor/advocatra` is a **git submodule** pinned
  to a commit of the `advocatra` repo (its `packages/*` aren't published
  to a registry yet). `pnpm-workspace.yaml` lists
  `vendor/advocatra/packages/*` as ordinary workspace members, so
  `@advocatra/case`/`billing`/`crypto`/`vault` resolve via the normal
  `workspace:*` protocol — verified to actually work, not assumed.
- **Redaction** (`redact.ts`, `scrub.ts`, `label-map.ts`) is the _only_
  place real field values are read. Every tool in `tools.ts` must return
  redacted objects, never a raw record from `@advocatra/case`/`billing`.
  - Name → a stable "Client N" label, assigned once per taxpayerId and
    persisted **locally only** (`~/.advocatra-mcp/<tenant>/labels.json`,
    gitignored, never transmitted) — so a label means the same person
    across restarts.
  - SSN/EIN → omitted by default; last-4 only (type-aware format) when a
    tool call explicitly passes `includeSsn: true`.
  - Address, phone, email → omitted entirely, never partially redacted.
  - Free-text fields (`Matter.notes`, `Correspondence.summary`,
    `ActivityLogEntry.description`/`.actor`, `Task.title`) → passed
    through `scrubFreeText`, which replaces SSN/EIN/phone/email-_shaped_
    substrings. **This does not catch a plain name or address written in
    prose** — an explicitly accepted gap (owner's call), not a bug. Don't
    "fix" this by trying to catch names; that was deliberately rejected in
    favor of a smaller, auditable regex surface.

## Hard limits for agents

1. **Never add a tool, or an import, that writes, uploads, encrypts, wraps
   a key, or acquires the editing lease.** Mechanically enforced by
   `scripts/check-no-write-tools.mjs` (CI-gated) against an explicit
   allowlist of safe imports from `@advocatra/crypto`/`vault`/`sync` — a
   PR that needs to widen that allowlist for a legitimate reason should
   say so explicitly in its description, not slip it in quietly.
2. **Never bypass `redact.ts` in a tool handler.** If a new tool needs a
   new field, add a redaction rule for it in `redact.ts` first, with a
   test proving the real value doesn't leak, the same way every existing
   field was done.
3. Never commit the vault master key file, a session token, real
   credentials, or any real taxpayer/client data. Synthetic fixtures only.
4. Never guess a missing decision; stop and ask, or record it here.
5. Never invent `advocatra` behaviour: schema/endpoint changes come from
   that repo; this one only consumes them via the submodule.
6. One task, one small branch, one PR, squash merge. Never push to `main`.

## Commands

| Command                     | Purpose                                               |
| --------------------------- | ----------------------------------------------------- |
| `pnpm install`              | install, including the submodule's workspace packages |
| `pnpm typecheck`            | `tsc --noEmit`                                        |
| `pnpm lint`                 | Biome check                                           |
| `pnpm test`                 | Vitest unit tests                                     |
| `pnpm check:spdx`           | every tracked source file has an SPDX header          |
| `pnpm check:licenses`       | dependency license scan                               |
| `pnpm check:no-write-tools` | fails if `src/` imports a write-capable export        |
| `pnpm start`                | run the server (stdio transport) against real config  |

## Definition of done (every PR)

- A test failed first and passes now; typecheck, lint, tests, and both
  guard scripts are green.
- If a new tool was added: it has a redaction test proving no raw PII
  field reaches its JSON output.

## Status

Working end-to-end: login → `GET /vault/snapshot` → local decrypt → 9
redacted read-only tools, verified against a real `createVault`-built
vault in tests (not just mocked). `check:no-write-tools` verified to
actually catch a planted violation before being trusted.

**Known gap**: no HTTP endpoint in `advocatra` yet stores or serves a
vault manifest (no server-side "create vault" flow exists — found while
building this repo; see `advocatra`'s own `TECHNICAL-DESIGN.md` §9).
`config.ts` works around this by accepting an already-unwrapped master
key from a local file rather than deriving one from a passphrase against
a real manifest. This is a stated pragmatic workaround, not the intended
final design — revisit once `advocatra` gets a real vault-setup endpoint,
at which point this server should do passphrase → `unlockVaultWithPassphrase`
like any other client, not take a raw key.

Not yet done: attachment/document _content_ (only metadata is exposed —
decrypting and summarizing actual notice/pleading PDFs is separate,
larger, higher-risk work), multi-tenant support (one server instance
assumes one tenant login), and a passphrase-based unlock flow (blocked on
the gap above).
