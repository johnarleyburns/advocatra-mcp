// SPDX-License-Identifier: AGPL-3.0-only
import { generateVaultMasterKeyMaterial } from "@advocatra/crypto";
import {
  emptyVaultRecords,
  encryptVaultSnapshot,
  type VaultRecords,
} from "@advocatra/vault";
import { describe, expect, it } from "vitest";
import type { LabelMapStore } from "./label-map.ts";
import { createTools } from "./tools.ts";
import type { SnapshotSource } from "./vault-session.ts";
import { VaultSession } from "./vault-session.ts";

class InMemoryLabelMapStore implements LabelMapStore {
  private readonly map = new Map<string, string>();
  get(taxpayerId: string): string | null {
    return this.map.get(taxpayerId) ?? null;
  }
  put(taxpayerId: string, label: string): void {
    this.map.set(taxpayerId, label);
  }
  all(): Record<string, string> {
    return Object.fromEntries(this.map);
  }
}

const sampleRecords: VaultRecords = {
  ...emptyVaultRecords(),
  taxpayers: [
    {
      id: "t1",
      type: "individual",
      name: "Jane Doe",
      taxpayerIdNumber: "123-45-6789",
      phones: ["555-123-4567"],
      emails: [],
    },
  ],
  matters: [
    {
      id: "m1",
      taxpayerId: "t1",
      category: "tax-court",
      matterType: "Deficiency",
      status: "open",
      taxYears: [2026],
      openedDate: "2027-01-01",
      taxCourtDetails: {
        court: "United States Tax Court",
        docketNumber: "12345-27",
        motions: [],
      },
    },
  ],
  tasks: [
    {
      id: "k1",
      matterId: "m1",
      title: "Call Jane Doe at 555-123-4567",
      status: "open",
      dueDate: "2020-01-01",
    },
  ],
};

async function makeTools(labelStore: LabelMapStore = new InMemoryLabelMapStore()) {
  const material = generateVaultMasterKeyMaterial();
  const snapshot = await encryptVaultSnapshot(sampleRecords, material, "vault-1");
  const source: SnapshotSource = {
    fetchSnapshot: async () => ({ revision: 1, snapshot }),
  };
  const session = new VaultSession(source, material, "vault-1");
  return createTools(session, labelStore);
}

describe("list_taxpayers", () => {
  it("never leaks the real name in any tool's output", async () => {
    const tools = await makeTools();
    const result = await tools.list_taxpayers({});
    expect(JSON.stringify(result)).not.toContain("Jane Doe");
    expect(result[0]?.label).toBe("Client 1");
  });
});

describe("list_matters", () => {
  it("replaces taxpayerId with a label and supports filtering", async () => {
    const tools = await makeTools();
    const all = await tools.list_matters({});
    expect(all).toHaveLength(1);
    expect(all[0]?.taxpayerLabel).toBe("Client 1");
    expect(await tools.list_matters({ status: "closed" })).toHaveLength(0);
  });
});

describe("get_upcoming_deadlines", () => {
  it("includes an overdue task", async () => {
    const tools = await makeTools();
    const deadlines = await tools.get_upcoming_deadlines({});
    const taskDeadline = deadlines.find((d) => d.kind === "task");
    expect(taskDeadline?.overdue).toBe(true);
    // NOT asserting the title is PII-free here: "Call Jane Doe" has no
    // structured SSN/EIN/phone/email pattern, so scrubFreeText's documented,
    // accepted gap (plain names in free text) applies — see scrub.test.ts's
    // "does NOT catch a plain name" test for that policy, proven separately.
  });

  it("scrubs structured PII typed into a task title", async () => {
    const tools = await makeTools();
    const deadlines = await tools.get_upcoming_deadlines({});
    const taskDeadline = deadlines.find((d) => d.kind === "task");
    expect(taskDeadline?.description).not.toContain("555-123-4567");
  });
});

describe("search", () => {
  it("finds a matter by matterType without leaking PII", async () => {
    const tools = await makeTools();
    const result = await tools.search({ query: "deficiency" });
    expect(result.matters).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("Jane Doe");
  });
});
