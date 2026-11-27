// SPDX-License-Identifier: AGPL-3.0-only
//
// Local configuration only — tenant host, login credentials, and the vault
// master key, all read from this machine. Nothing here is ever sent
// anywhere except the tenant host (for login) and the GET /vault/snapshot
// request, both already-authenticated, ciphertext-only calls.
//
// PRAGMATIC WORKAROUND, not the final design: there is no HTTP endpoint
// yet that stores or serves a vault manifest (no server-side "create
// vault" flow exists — see TECHNICAL-DESIGN.md §9 in the advocatra repo
// and this repo's own CLAUDE.md). Until that exists, this server accepts
// the already-unwrapped vault master key directly, base64, from a local
// file — never a passphrase it would derive a key from. The master key
// never leaves this process; the cloud never sees it either way.

import { readFileSync } from "node:fs";
import { base64ToBytes } from "@advocatra/crypto";

export interface Config {
  readonly tenantHost: string;
  readonly email: string;
  readonly password: string;
  readonly totpCode?: string;
  readonly vaultId: string;
  readonly masterKeyMaterial: Uint8Array;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is not set. See README.md for required configuration.`);
  return value;
}

export function loadConfig(): Config {
  const vaultKeyPath = requireEnv("ADVOCATRA_VAULT_KEY_FILE");
  const masterKeyMaterial = base64ToBytes(readFileSync(vaultKeyPath, "utf8").trim());
  return {
    tenantHost: requireEnv("ADVOCATRA_TENANT_HOST"),
    email: requireEnv("ADVOCATRA_EMAIL"),
    password: requireEnv("ADVOCATRA_PASSWORD"),
    ...(process.env.ADVOCATRA_TOTP_CODE
      ? { totpCode: process.env.ADVOCATRA_TOTP_CODE }
      : {}),
    vaultId: requireEnv("ADVOCATRA_VAULT_ID"),
    masterKeyMaterial,
  };
}
