// SPDX-License-Identifier: AGPL-3.0-only
import { createVault } from "@advocatra/vault";
import { describe, expect, it } from "vitest";
import type { ManifestSource } from "./unlock.ts";
import { unlockMasterKey, VaultManifestMissingError } from "./unlock.ts";

async function buildManifestJson() {
  const { manifest, masterKeyMaterial, recoveryCode } = await createVault({
    vaultId: "vault-1",
    appVersion: "test",
    createdAt: new Date().toISOString(),
    passphrase: "correct horse battery staple",
  });
  return { manifestJson: JSON.stringify(manifest), masterKeyMaterial, recoveryCode };
}

describe("unlockMasterKey", () => {
  it("unlocks with the correct passphrase and returns the real master key", async () => {
    const { manifestJson, masterKeyMaterial } = await buildManifestJson();
    const source: ManifestSource = { fetchManifest: async () => manifestJson };
    const result = await unlockMasterKey(source, {
      passphrase: "correct horse battery staple",
    });
    expect(result).toEqual(masterKeyMaterial);
  });

  it("unlocks with the recovery code shown at vault creation", async () => {
    const { manifestJson, masterKeyMaterial, recoveryCode } = await buildManifestJson();
    const source: ManifestSource = { fetchManifest: async () => manifestJson };
    const result = await unlockMasterKey(source, { recoveryCode });
    expect(result).toEqual(masterKeyMaterial);
  });

  it("rejects an incorrect passphrase", async () => {
    const { manifestJson } = await buildManifestJson();
    const source: ManifestSource = { fetchManifest: async () => manifestJson };
    await expect(
      unlockMasterKey(source, { passphrase: "wrong passphrase" }),
    ).rejects.toThrow();
  });

  it("throws VaultManifestMissingError when no vault has been created yet", async () => {
    const source: ManifestSource = { fetchManifest: async () => null };
    await expect(
      unlockMasterKey(source, { passphrase: "anything" }),
    ).rejects.toBeInstanceOf(VaultManifestMissingError);
  });

  it("throws when neither a passphrase nor a recovery code is given", async () => {
    const { manifestJson } = await buildManifestJson();
    const source: ManifestSource = { fetchManifest: async () => manifestJson };
    await expect(unlockMasterKey(source, {})).rejects.toThrow();
  });
});
