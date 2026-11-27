// SPDX-License-Identifier: AGPL-3.0-only
//
// Talks to the tenant's Vault Durable Object exactly the way a browser tab
// would: logs in, holds the session cookie, downloads the encrypted
// snapshot. Never calls anything that decrypts server-side (there is no
// such thing to call) and never uploads — this server has no write path.

import { type EncryptedEnvelope, EncryptedEnvelopeSchema } from "@advocatra/crypto";

export class CloudAuthError extends Error {}

export interface CloudClientConfig {
  readonly tenantHost: string;
  readonly email: string;
  readonly password: string;
  readonly totpCode?: string;
}

export class CloudClient {
  private sessionCookie: string | null = null;

  constructor(private readonly config: CloudClientConfig) {}

  private baseUrl(): string {
    return `https://${this.config.tenantHost}`;
  }

  private async login(): Promise<void> {
    const response = await fetch(`${this.baseUrl()}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: this.config.email,
        password: this.config.password,
        ...(this.config.totpCode ? { totpCode: this.config.totpCode } : {}),
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new CloudAuthError(
        (body as { error?: string }).error ?? `login failed: ${response.status}`,
      );
    }
    const setCookie = response.headers.get("set-cookie");
    if (!setCookie)
      throw new CloudAuthError("login succeeded but no session cookie was returned");
    this.sessionCookie = setCookie.split(";")[0] ?? null;
  }

  private async authedFetch(
    path: string,
    init?: RequestInit,
    retried = false,
  ): Promise<Response> {
    if (!this.sessionCookie) await this.login();
    const response = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers: { ...init?.headers, Cookie: this.sessionCookie ?? "" },
    });
    if (response.status === 401 && !retried) {
      this.sessionCookie = null;
      return this.authedFetch(path, init, true);
    }
    return response;
  }

  /** Downloads the latest encrypted snapshot. `snapshot` is null for a vault never uploaded. */
  async fetchSnapshot(): Promise<{
    revision: number;
    snapshot: EncryptedEnvelope | null;
  }> {
    const response = await this.authedFetch("/vault/snapshot");
    if (!response.ok) throw new Error(`GET /vault/snapshot failed: ${response.status}`);
    const body = (await response.json()) as { revision: number; snapshot: unknown };
    return {
      revision: body.revision,
      snapshot: body.snapshot ? EncryptedEnvelopeSchema.parse(body.snapshot) : null,
    };
  }
}
