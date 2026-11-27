// SPDX-License-Identifier: AGPL-3.0-only
import { homedir } from "node:os";
import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CloudClient } from "./cloud-client.ts";
import { loadConfig } from "./config.ts";
import { FileLabelMapStore } from "./label-map.ts";
import { buildServer } from "./server.ts";
import { createTools } from "./tools.ts";
import { VaultSession } from "./vault-session.ts";

async function main(): Promise<void> {
  const config = loadConfig();
  const cloud = new CloudClient(config);
  const session = new VaultSession(cloud, config.masterKeyMaterial, config.vaultId);
  const labelStore = new FileLabelMapStore(
    join(homedir(), ".advocatra-mcp", config.tenantHost, "labels.json"),
  );
  const tools = createTools(session, labelStore);
  const server = buildServer(tools);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("advocatra-mcp failed to start:", error);
  process.exit(1);
});
