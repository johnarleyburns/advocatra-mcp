// SPDX-License-Identifier: AGPL-3.0-only
//
// Holds the decrypted VaultRecords in this process's memory only, keyed by
// revision so it's never re-decrypted unnecessarily. Decryption happens
// here, locally, using the master key from config — never on the cloud.

import type { EncryptedEnvelope } from "@advocatra/crypto";
import {
  decryptVaultSnapshot,
  emptyVaultRecords,
  type VaultRecords,
} from "@advocatra/vault";

/** Just the one call this session needs — lets tests pass a fake instead of a real `CloudClient`. */
export interface SnapshotSource {
  fetchSnapshot(): Promise<{ revision: number; snapshot: EncryptedEnvelope | null }>;
}

export class VaultSession {
  private cached: { revision: number; records: VaultRecords } | null = null;

  constructor(
    private readonly cloud: SnapshotSource,
    private readonly masterKeyMaterial: Uint8Array,
    private readonly vaultId: string,
  ) {}

  /** Returns the current decrypted records, re-fetching/decrypting only if the cloud revision has changed. */
  async records(): Promise<VaultRecords> {
    const { revision, snapshot } = await this.cloud.fetchSnapshot();
    if (!snapshot) return emptyVaultRecords();
    if (this.cached && this.cached.revision === revision) return this.cached.records;
    const records = await decryptVaultSnapshot(
      snapshot,
      this.masterKeyMaterial,
      this.vaultId,
    );
    this.cached = { revision, records };
    return records;
  }
}
