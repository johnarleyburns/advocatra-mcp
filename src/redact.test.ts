// SPDX-License-Identifier: AGPL-3.0-only
import type { Taxpayer } from "@advocatra/case";
import { describe, expect, it } from "vitest";
import type { LabelMapStore } from "./label-map.ts";
import {
  redactActivityLogEntry,
  redactCorrespondence,
  redactDocumentMetadata,
  redactMatter,
  redactTask,
  redactTaxpayer,
} from "./redact.ts";

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

const janeDoe: Taxpayer = {
  id: "t1",
  type: "individual",
  name: "Jane Doe",
  taxpayerIdNumber: "123-45-6789",
  address: "123 Main St, Springfield",
  phones: ["555-123-4567"],
  emails: ["jane@example.com"],
  notes: "Called 555-999-8888 to confirm filing status",
};

describe("redactTaxpayer", () => {
  it("never includes the real name, address, phones, or emails", () => {
    const redacted = redactTaxpayer(janeDoe, new InMemoryLabelMapStore());
    expect(JSON.stringify(redacted)).not.toContain("Jane Doe");
    expect(JSON.stringify(redacted)).not.toContain("Main St");
    expect(JSON.stringify(redacted)).not.toContain("555-123-4567");
    expect(JSON.stringify(redacted)).not.toContain("jane@example.com");
  });

  it("uses a stable Client N label instead of the real name", () => {
    const redacted = redactTaxpayer(janeDoe, new InMemoryLabelMapStore());
    expect(redacted.label).toBe("Client 1");
  });

  it("omits the SSN by default", () => {
    const redacted = redactTaxpayer(janeDoe, new InMemoryLabelMapStore());
    expect(redacted.taxpayerIdNumberRedacted).toBeUndefined();
  });

  it("shows only the last four of the SSN when includeSsn is true", () => {
    const redacted = redactTaxpayer(janeDoe, new InMemoryLabelMapStore(), {
      includeSsn: true,
    });
    expect(redacted.taxpayerIdNumberRedacted).toBe("XXX-XX-6789");
  });

  it("formats an EIN differently from an SSN", () => {
    const business: Taxpayer = {
      ...janeDoe,
      type: "business",
      taxpayerIdNumber: "12-3456789",
    };
    const redacted = redactTaxpayer(business, new InMemoryLabelMapStore(), {
      includeSsn: true,
    });
    expect(redacted.taxpayerIdNumberRedacted).toBe("XX-XXX6789");
  });

  it("scrubs structured PII out of free-text notes, but a plain name slips through (documented gap)", () => {
    const redacted = redactTaxpayer(janeDoe, new InMemoryLabelMapStore());
    expect(redacted.notes).toBe("Called [REDACTED-PHONE] to confirm filing status");
  });
});

describe("redactMatter", () => {
  it("replaces taxpayerId's identity with a label, keeps structural fields", () => {
    const matter = {
      id: "m1",
      taxpayerId: "t1",
      category: "examination" as const,
      matterType: "Field audit",
      status: "open" as const,
      taxYears: [2026],
      openedDate: "2027-01-01",
      notes: "SSN confirmed as 123-45-6789 on intake call",
    };
    const redacted = redactMatter(matter, new InMemoryLabelMapStore());
    expect(redacted.taxpayerLabel).toBe("Client 1");
    expect(redacted.matterType).toBe("Field audit");
    expect(redacted.notes).toBe("SSN confirmed as [REDACTED-SSN] on intake call");
  });
});

describe("redactTask / redactCorrespondence / redactActivityLogEntry", () => {
  it("scrubs the task title", () => {
    const task = {
      id: "k1",
      matterId: "m1",
      title: "Call client at 555-123-4567",
      status: "open" as const,
    };
    expect(redactTask(task).title).toBe("Call client at [REDACTED-PHONE]");
  });

  it("scrubs the correspondence summary", () => {
    const correspondence = {
      id: "c1",
      matterId: "m1",
      direction: "inbound" as const,
      method: "mail" as const,
      date: "2027-01-01",
      summary: "Notice sent to jane@example.com",
      relatedDocumentIds: [],
    };
    expect(redactCorrespondence(correspondence).summary).toBe(
      "Notice sent to [REDACTED-EMAIL]",
    );
  });

  it("scrubs the activity log description and actor", () => {
    const entry = {
      id: "a1",
      matterId: "m1",
      timestamp: "2027-01-01T00:00:00Z",
      actor: "practitioner",
      type: "note",
      description: "Reached client at 555-123-4567",
    };
    expect(redactActivityLogEntry(entry).description).toBe(
      "Reached client at [REDACTED-PHONE]",
    );
  });
});

describe("redactDocumentMetadata", () => {
  it("omits encryptedObjectRef entirely and scrubs the description", () => {
    const document = {
      id: "d1",
      taxpayerId: "t1",
      matterId: "m1",
      type: "notice" as const,
      description: "Notice re SSN 123-45-6789",
      encryptedObjectRef: "sha256:abc123",
      uploadedAt: "2027-01-01T00:00:00Z",
    };
    const redacted = redactDocumentMetadata(document);
    expect(redacted).not.toHaveProperty("encryptedObjectRef");
    expect(redacted.description).toBe("Notice re SSN [REDACTED-SSN]");
  });
});
