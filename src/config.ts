// SPDX-License-Identifier: AGPL-3.0-only
//
// Local configuration only — tenant host, login credentials, and the
// secret used to unlock the vault, all read from this machine. Nothing
// here is ever sent anywhere except the tenant host (for login) and the
// GET /vault/manifest and GET /vault/snapshot requests, both
// already-authenticated, ciphertext/wrapped-key-only calls — see
// unlock.ts for where the passphrase/recovery code is actually used (only
// in this process, never transmitted).

export interface Config {
  readonly tenantHost: string;
  readonly email: string;
  readonly password: string;
  readonly totpCode?: string;
  readonly vaultId: string;
  readonly passphrase?: string;
  readonly recoveryCode?: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is not set. See README.md for required configuration.`);
  return value;
}

export function loadConfig(): Config {
  const passphrase = process.env.ADVOCATRA_VAULT_PASSPHRASE;
  const recoveryCode = process.env.ADVOCATRA_VAULT_RECOVERY_CODE;
  if (!passphrase && !recoveryCode) {
    throw new Error(
      "set either ADVOCATRA_VAULT_PASSPHRASE or ADVOCATRA_VAULT_RECOVERY_CODE. See README.md for required configuration.",
    );
  }
  return {
    tenantHost: requireEnv("ADVOCATRA_TENANT_HOST"),
    email: requireEnv("ADVOCATRA_EMAIL"),
    password: requireEnv("ADVOCATRA_PASSWORD"),
    ...(process.env.ADVOCATRA_TOTP_CODE
      ? { totpCode: process.env.ADVOCATRA_TOTP_CODE }
      : {}),
    vaultId: requireEnv("ADVOCATRA_VAULT_ID"),
    ...(passphrase ? { passphrase } : {}),
    ...(recoveryCode ? { recoveryCode } : {}),
  };
}
