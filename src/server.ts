// SPDX-License-Identifier: AGPL-3.0-only
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { createTools } from "./tools.ts";

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

/** Registers every read-only tool. No tool defined here may take a write/delete/mutate argument path. */
export function buildServer(tools: ReturnType<typeof createTools>): McpServer {
  const server = new McpServer({ name: "advocatra-mcp", version: "0.0.0" });

  server.registerTool(
    "list_taxpayers",
    {
      description:
        "List all taxpayers (clients), redacted — no real names, SSNs, or addresses.",
      inputSchema: {
        includeSsn: z
          .boolean()
          .optional()
          .describe("Include last-4 SSN/EIN. Default false."),
      },
    },
    async (args) => jsonResult(await tools.list_taxpayers(args)),
  );

  server.registerTool(
    "get_taxpayer",
    {
      description: "Get one taxpayer by id, redacted.",
      inputSchema: { taxpayerId: z.string(), includeSsn: z.boolean().optional() },
    },
    async (args) => jsonResult(await tools.get_taxpayer(args)),
  );

  server.registerTool(
    "list_matters",
    {
      description:
        "List matters, optionally filtered by taxpayer, category, or status.",
      inputSchema: {
        taxpayerId: z.string().optional(),
        category: z.string().optional(),
        status: z.string().optional(),
      },
    },
    async (args) => jsonResult(await tools.list_matters(args)),
  );

  server.registerTool(
    "list_tasks",
    {
      description: "List tasks, optionally filtered by matter or status.",
      inputSchema: { matterId: z.string().optional(), status: z.string().optional() },
    },
    async (args) => jsonResult(await tools.list_tasks(args)),
  );

  server.registerTool(
    "get_upcoming_deadlines",
    {
      description:
        "Upcoming and overdue deadlines across tasks and Tax Court petition dates.",
      inputSchema: { withinDays: z.number().int().positive().optional() },
    },
    async (args) => jsonResult(await tools.get_upcoming_deadlines(args)),
  );

  server.registerTool(
    "list_correspondence",
    {
      description: "List correspondence for a matter, redacted.",
      inputSchema: { matterId: z.string() },
    },
    async (args) => jsonResult(await tools.list_correspondence(args)),
  );

  server.registerTool(
    "list_documents",
    {
      description:
        "List document metadata for a matter (never the document bytes/content).",
      inputSchema: { matterId: z.string() },
    },
    async (args) => jsonResult(await tools.list_documents(args)),
  );

  server.registerTool(
    "list_activity",
    {
      description: "List the activity log for a matter, redacted.",
      inputSchema: { matterId: z.string() },
    },
    async (args) => jsonResult(await tools.list_activity(args)),
  );

  server.registerTool(
    "search",
    {
      description: "Search matter types and task titles for a query string.",
      inputSchema: { query: z.string().min(1) },
    },
    async (args) => jsonResult(await tools.search(args)),
  );

  return server;
}
