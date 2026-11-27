// SPDX-License-Identifier: AGPL-3.0-only
//
// Fetches the tenant's vault manifest from the cloud (the opaque JSON blob
// a client created with createVault) and unwraps the vault master key
// locally with the operator's own passphrase or recovery code — exactly
// the sequence any other client (browser, native app) performs. The cloud
// never sees the passphrase, the recovery code, or the unwrapped key.

import {
  unlockVaultWithPassphrase,
  unlockVaultWithRecoveryCode,
  type VaultManifest,
  VaultManifestSchema,
} from "@advocatra/vault";

export class VaultManifestMissingError extends Error {}

export interface ManifestSource {
  fetchManifest(): Promise<string | null>;
}

export interface UnlockSecret {
  readonly passphrase?: string;
  readonly recoveryCode?: string;
}

export async function unlockMasterKey(
  cloud: ManifestSource,
  secret: UnlockSecret,
): Promise<Uint8Array> {
  const json = await cloud.fetchManifest();
  if (!json) {
    throw new VaultManifestMissingError(
      "no vault has been created yet for this tenant -- set one up from the web app or a native client first",
    );
  }
  const manifest: VaultManifest = VaultManifestSchema.parse(JSON.parse(json));
  if (secret.passphrase) return unlockVaultWithPassphrase(manifest, secret.passphrase);
  if (secret.recoveryCode)
    return unlockVaultWithRecoveryCode(manifest, secret.recoveryCode);
  throw new Error("neither a passphrase nor a recovery code was provided");
}
