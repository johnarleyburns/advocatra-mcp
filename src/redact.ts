// SPDX-License-Identifier: AGPL-3.0-only
//
// Applies the locked-in PII policy to every record before it's returned
// from an MCP tool. Structured PII (name, SSN/EIN, address, phone, email)
// is replaced or omitted outright; free-text fields are passed through
// `scrubFreeText`. This is the ONLY place real taxpayer field values are
// read by this server and must never be bypassed by a tool handler.

import type {
  ActivityLogEntry,
  CaseDocument,
  Correspondence,
  Matter,
  Task,
  Taxpayer,
} from "@advocatra/case";
import type { LabelMapStore } from "./label-map.ts";
import { labelFor } from "./label-map.ts";
import { scrubFreeText } from "./scrub.ts";

/** `123-45-6789` -> `XXX-XX-6789`. `12-3456789` -> `XX-XXX6789`. */
function redactTaxId(value: string, type: Taxpayer["type"]): string {
  const digits = value.replace(/\D/g, "");
  const last4 = digits.slice(-4).padStart(4, "0");
  return type === "individual" ? `XXX-XX-${last4}` : `XX-XXX${last4}`;
}

export interface RedactedTaxpayer {
  readonly label: string;
  readonly type: Taxpayer["type"];
  readonly taxpayerIdNumberRedacted?: string;
  readonly representationAuthorization?: Taxpayer["representationAuthorization"];
  readonly notes?: string;
}

export function redactTaxpayer(
  taxpayer: Taxpayer,
  labelStore: LabelMapStore,
  options: { includeSsn?: boolean | undefined } = {},
): RedactedTaxpayer {
  const label = labelFor(labelStore, taxpayer.id);
  return {
    label,
    type: taxpayer.type,
    ...(options.includeSsn && taxpayer.taxpayerIdNumber
      ? {
          taxpayerIdNumberRedacted: redactTaxId(
            taxpayer.taxpayerIdNumber,
            taxpayer.type,
          ),
        }
      : {}),
    ...(taxpayer.representationAuthorization
      ? { representationAuthorization: taxpayer.representationAuthorization }
      : {}),
    ...(taxpayer.notes ? { notes: scrubFreeText(taxpayer.notes) } : {}),
  };
  // Deliberately omitted, always: taxpayer.name, .address, .phones, .emails.
}

export type RedactedMatter = Omit<Matter, "notes" | "assignedPractitioner"> & {
  taxpayerLabel: string;
  notes?: string;
};

export function redactMatter(
  matter: Matter,
  labelStore: LabelMapStore,
): RedactedMatter {
  const { notes, taxpayerId, assignedPractitioner, ...rest } = matter;
  return {
    ...rest,
    taxpayerId,
    taxpayerLabel: labelFor(labelStore, taxpayerId),
    ...(assignedPractitioner
      ? { assignedPractitioner: scrubFreeText(assignedPractitioner) }
      : {}),
    ...(notes ? { notes: scrubFreeText(notes) } : {}),
  };
}

export function redactTask(task: Task): Task {
  return { ...task, title: scrubFreeText(task.title) };
}

export function redactCorrespondence(correspondence: Correspondence): Correspondence {
  return { ...correspondence, summary: scrubFreeText(correspondence.summary) };
}

export function redactActivityLogEntry(entry: ActivityLogEntry): ActivityLogEntry {
  return {
    ...entry,
    description: scrubFreeText(entry.description),
    actor: scrubFreeText(entry.actor),
  };
}

/** Document metadata only — `encryptedObjectRef` is never resolved to bytes by this server. */
export function redactDocumentMetadata(
  document: CaseDocument,
): Omit<CaseDocument, "encryptedObjectRef" | "description"> & { description: string } {
  const { encryptedObjectRef, description, ...rest } = document;
  return { ...rest, description: scrubFreeText(description) };
}
