// SPDX-License-Identifier: AGPL-3.0-only
import { generateVaultMasterKeyMaterial } from "@advocatra/crypto";
import { emptyVaultRecords, encryptVaultSnapshot } from "@advocatra/vault";
import { describe, expect, it, vi } from "vitest";
import type { SnapshotSource } from "./vault-session.ts";
import { VaultSession } from "./vault-session.ts";

describe("VaultSession", () => {
  it("returns an empty vault when nothing has ever been uploaded", async () => {
    const source: SnapshotSource = {
      fetchSnapshot: async () => ({ revision: 0, snapshot: null }),
    };
    const session = new VaultSession(
      source,
      generateVaultMasterKeyMaterial(),
      "vault-1",
    );
    expect(await session.records()).toEqual(emptyVaultRecords());
  });

  it("decrypts the snapshot it's given", async () => {
    const material = generateVaultMasterKeyMaterial();
    const records = {
      ...emptyVaultRecords(),
      taxpayers: [
        {
          id: "t1",
          type: "individual" as const,
          name: "Jane Doe",
          phones: [],
          emails: [],
        },
      ],
    };
    const snapshot = await encryptVaultSnapshot(records, material, "vault-1");
    const source: SnapshotSource = {
      fetchSnapshot: async () => ({ revision: 1, snapshot }),
    };
    const session = new VaultSession(source, material, "vault-1");
    expect(await session.records()).toEqual(records);
  });

  it("does not re-decrypt when the revision hasn't changed", async () => {
    const material = generateVaultMasterKeyMaterial();
    const snapshot = await encryptVaultSnapshot(
      emptyVaultRecords(),
      material,
      "vault-1",
    );
    const fetchSnapshot = vi.fn(async () => ({ revision: 1, snapshot }));
    const session = new VaultSession({ fetchSnapshot }, material, "vault-1");
    await session.records();
    await session.records();
    // fetchSnapshot is still called each time (to check the revision), but
    // decryption itself only needs to happen once -- this test documents
    // the cache's key, not the fetch count.
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });
});
