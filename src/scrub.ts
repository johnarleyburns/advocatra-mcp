// SPDX-License-Identifier: AGPL-3.0-only
//
// Best-effort local scrub of SSN/EIN/phone/email-*shaped* patterns inside
// free-text fields (Matter.notes, Correspondence.summary, etc.) before they
// reach the LLM. This is a deliberately limited, locked-in policy — it
// catches structured-looking PII typed into prose; it will NOT catch a
// plain name or street address written in a sentence. That residual gap
// is accepted, not solved. See CLAUDE.md.

const PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: "EIN", regex: /\b\d{2}-\d{7}\b/g },
  // Two shapes, handled separately: a leading "\b" doesn't fire before an
  // *optional* "(" (both the preceding space and "(" are non-word, so no
  // boundary exists there), which left the "(" outside the match and
  // leaked it — caught by this file's own test, not assumed correct.
  { name: "PHONE", regex: /(?:\+1[-.\s]?)?\(\d{3}\)[-.\s]?\d{3}[-.\s]\d{4}/g },
  { name: "PHONE", regex: /\b(?:\+1[-.\s]?)?\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g },
  { name: "EMAIL", regex: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
];

/** Replaces any SSN/EIN/phone/email-shaped substring with a `[REDACTED-<KIND>]` marker. */
export function scrubFreeText(text: string): string {
  let result = text;
  for (const { name, regex } of PATTERNS) {
    result = result.replace(regex, `[REDACTED-${name}]`);
  }
  return result;
}
