#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Mechanically enforces this repo's one safety rule: read-only, always.
// Scans src/**/*.ts (excluding tests) for imports from @advocatra/crypto,
// @advocatra/vault or @advocatra/sync and fails if anything outside a
// short, explicit allowlist is imported — in particular, every function
// that creates a vault, wraps/encrypts data, or acquires the editing
// lease (a precondition for uploading). Adding a new import here must be
// a deliberate, reviewed change to this list, not an accident.
//
// Handles both `import type { X } from "pkg"` (whole-statement type-only)
// and `import { type X } from "pkg"` (per-name modifier) — allowlist
// membership is checked against the bare name either way, since whether a
// symbol is imported as a type or a value doesn't change whether it's
// safe to expose.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ALLOWED = {
  "@advocatra/crypto": new Set([
    "base64ToBytes",
    "EncryptedEnvelopeSchema",
    "EncryptedEnvelope",
  ]),
  "@advocatra/vault": new Set([
    "decryptVaultSnapshot",
    "decryptDocumentObject",
    "emptyVaultRecords",
    "VaultRecords",
  ]),
  "@advocatra/sync": new Set([]),
};

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "src"],
  {
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

const violations = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const importRegex =
    /import\s+(type\s+)?\{([^}]*)\}\s+from\s+["'](@advocatra\/(?:crypto|vault|sync))["']/g;
  for (const match of text.matchAll(importRegex)) {
    const names = match[2];
    const pkg = match[3];
    const allowed = ALLOWED[pkg] ?? new Set();
    for (const rawName of names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)) {
      const name = rawName.replace(/^type\s+/, "");
      if (!allowed.has(name)) {
        violations.push(`${file}: imports "${name}" from ${pkg}, not on the allowlist`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Read-only boundary violated:");
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log(`check-no-write-tools: ${files.length} src file(s) clean.`);
