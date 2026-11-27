// SPDX-License-Identifier: AGPL-3.0-only
//
// Read-only tool implementations. No tool here, or ever added to this
// file, may call anything that writes, uploads, or mutates vault state —
// enforced mechanically by scripts/check-no-write-tools.mjs, not just by
// this comment. Every record returned goes through redact.ts first.

import { isTaskOverdue } from "@advocatra/case";
import type { LabelMapStore } from "./label-map.ts";
import {
  redactActivityLogEntry,
  redactCorrespondence,
  redactDocumentMetadata,
  redactMatter,
  redactTask,
  redactTaxpayer,
} from "./redact.ts";
import { scrubFreeText } from "./scrub.ts";
import type { VaultSession } from "./vault-session.ts";

export function createTools(session: VaultSession, labelStore: LabelMapStore) {
  return {
    async list_taxpayers(args: { includeSsn?: boolean | undefined }) {
      const records = await session.records();
      return records.taxpayers.map((t) => redactTaxpayer(t, labelStore, args));
    },

    async get_taxpayer(args: { taxpayerId: string; includeSsn?: boolean | undefined }) {
      const records = await session.records();
      const taxpayer = records.taxpayers.find((t) => t.id === args.taxpayerId);
      if (!taxpayer) return null;
      return redactTaxpayer(taxpayer, labelStore, args);
    },

    async list_matters(args: {
      taxpayerId?: string | undefined;
      category?: string | undefined;
      status?: string | undefined;
    }) {
      const records = await session.records();
      return records.matters
        .filter((m) => !args.taxpayerId || m.taxpayerId === args.taxpayerId)
        .filter((m) => !args.category || m.category === args.category)
        .filter((m) => !args.status || m.status === args.status)
        .map((m) => redactMatter(m, labelStore));
    },

    async list_tasks(args: {
      matterId?: string | undefined;
      status?: string | undefined;
    }) {
      const records = await session.records();
      return records.tasks
        .filter((t) => !args.matterId || t.matterId === args.matterId)
        .filter((t) => !args.status || t.status === args.status)
        .map(redactTask);
    },

    /** Merges open task due dates and Tax Court deadlines — there is no separate calendar object in the schema. */
    async get_upcoming_deadlines(args: { withinDays?: number | undefined }) {
      const records = await session.records();
      const now = new Date();
      const horizon = new Date(
        now.getTime() + (args.withinDays ?? 30) * 24 * 60 * 60 * 1000,
      );

      const taskDeadlines = records.tasks
        .filter((t) => t.dueDate)
        .filter((t) => {
          const due = new Date(t.dueDate as string);
          return due <= horizon || isTaskOverdue(t, now);
        })
        .map((t) => ({
          kind: "task" as const,
          matterId: t.matterId,
          date: t.dueDate,
          overdue: isTaskOverdue(t, now),
          description: scrubFreeText(t.title),
        }));

      const taxCourtDeadlines = records.matters
        .filter((m) => m.taxCourtDetails?.petitionDeadline)
        .filter(
          (m) => new Date(m.taxCourtDetails?.petitionDeadline as string) <= horizon,
        )
        .map((m) => ({
          kind: "tax-court-petition-deadline" as const,
          matterId: m.id,
          date: m.taxCourtDetails?.petitionDeadline,
          overdue: false,
          description: scrubFreeText(
            `Petition deadline, docket ${m.taxCourtDetails?.docketNumber ?? "(none)"}`,
          ),
        }));

      return [...taskDeadlines, ...taxCourtDeadlines].sort((a, b) =>
        (a.date ?? "").localeCompare(b.date ?? ""),
      );
    },

    async list_correspondence(args: { matterId: string }) {
      const records = await session.records();
      return records.correspondence
        .filter((c) => c.matterId === args.matterId)
        .map(redactCorrespondence);
    },

    async list_documents(args: { matterId: string }) {
      const records = await session.records();
      return records.documents
        .filter((d) => d.matterId === args.matterId)
        .map(redactDocumentMetadata);
    },

    async list_activity(args: { matterId: string }) {
      const records = await session.records();
      return records.activity
        .filter((a) => a.matterId === args.matterId)
        .map(redactActivityLogEntry);
    },

    async search(args: { query: string }) {
      const records = await session.records();
      const needle = args.query.toLowerCase();
      const matterHits = records.matters.filter((m) =>
        m.matterType.toLowerCase().includes(needle),
      );
      const taskHits = records.tasks.filter((t) =>
        t.title.toLowerCase().includes(needle),
      );
      return {
        matters: matterHits.map((m) => redactMatter(m, labelStore)),
        tasks: taskHits.map(redactTask),
      };
    },
  };
}
