// SPDX-License-Identifier: AGPL-3.0-only
//
// A stable, local-only mapping from a real taxpayerId to a display label
// ("Client 1", "Client 2", ...). Never transmitted anywhere — persisted
// only on the machine running this MCP server, so a label means the same
// person across restarts and conversations. This is the mechanism behind
// the "redacted names" policy: the LLM never sees a real name, ever.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface LabelMapStore {
  get(taxpayerId: string): string | null;
  put(taxpayerId: string, label: string): void;
  all(): Record<string, string>;
}

export class FileLabelMapStore implements LabelMapStore {
  private readonly map: Record<string, string>;

  constructor(private readonly filePath: string) {
    this.map = this.load();
  }

  private load(): Record<string, string> {
    try {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.map, null, 2), { mode: 0o600 });
  }

  get(taxpayerId: string): string | null {
    return this.map[taxpayerId] ?? null;
  }

  put(taxpayerId: string, label: string): void {
    this.map[taxpayerId] = label;
    this.save();
  }

  all(): Record<string, string> {
    return { ...this.map };
  }
}

/** Returns this taxpayer's stable "Client N" label, assigning the next unused N if it has none yet. */
export function labelFor(store: LabelMapStore, taxpayerId: string): string {
  const existing = store.get(taxpayerId);
  if (existing) return existing;
  const usedNumbers = Object.values(store.all())
    .map((label) => Number(label.match(/^Client (\d+)$/)?.[1]))
    .filter((n) => Number.isInteger(n));
  const next = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
  const label = `Client ${next}`;
  store.put(taxpayerId, label);
  return label;
}
