// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { type LabelMapStore, labelFor } from "./label-map.ts";

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

describe("labelFor", () => {
  it("assigns Client 1 to the first taxpayer seen", () => {
    const store = new InMemoryLabelMapStore();
    expect(labelFor(store, "t1")).toBe("Client 1");
  });

  it("returns the same label for the same taxpayer on repeated calls", () => {
    const store = new InMemoryLabelMapStore();
    labelFor(store, "t1");
    expect(labelFor(store, "t1")).toBe("Client 1");
  });

  it("assigns increasing numbers to different taxpayers", () => {
    const store = new InMemoryLabelMapStore();
    expect(labelFor(store, "t1")).toBe("Client 1");
    expect(labelFor(store, "t2")).toBe("Client 2");
    expect(labelFor(store, "t3")).toBe("Client 3");
  });

  it("never reveals the real taxpayerId in the label", () => {
    const store = new InMemoryLabelMapStore();
    const label = labelFor(store, "real-ssn-looking-id-123-45-6789");
    expect(label).not.toContain("123-45-6789");
  });
});
