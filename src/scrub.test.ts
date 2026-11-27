// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { scrubFreeText } from "./scrub.ts";

describe("scrubFreeText", () => {
  it("redacts an SSN-shaped substring", () => {
    expect(scrubFreeText("client's SSN is 123-45-6789, confirmed")).toBe(
      "client's SSN is [REDACTED-SSN], confirmed",
    );
  });

  it("redacts an EIN-shaped substring", () => {
    expect(scrubFreeText("EIN 12-3456789 on file")).toBe("EIN [REDACTED-EIN] on file");
  });

  it("redacts a phone-shaped substring", () => {
    expect(scrubFreeText("call back at (555) 123-4567")).toBe(
      "call back at [REDACTED-PHONE]",
    );
  });

  it("redacts an email-shaped substring", () => {
    expect(scrubFreeText("emailed jane.doe@example.com yesterday")).toBe(
      "emailed [REDACTED-EMAIL] yesterday",
    );
  });

  it("does not touch plain prose with no structured PII", () => {
    expect(scrubFreeText("spoke with the client about the 2026 return")).toBe(
      "spoke with the client about the 2026 return",
    );
  });

  it("does NOT catch a plain name — documented, accepted gap", () => {
    expect(scrubFreeText("spoke with John Smith about his return")).toBe(
      "spoke with John Smith about his return",
    );
  });
});
