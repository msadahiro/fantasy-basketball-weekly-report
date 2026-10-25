import { randomBytes, timingSafeEqual } from "node:crypto";

const AUTH_URL =
  "https://api.login.yahoo.com/oauth2/request_auth";

const MAX_AGE_MS = 10 * 60 * 1000;

interface PendingAuthorization {
  state: string;
  createdAt: number;
}

function validateRedirectUri(value: string): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid Yahoo redirect URI");
  }

  const loopback = [
    "localhost",
    "127.0.0.1",
    "[::1]",
  ].includes(url.hostname);

  if (
    !(url.protocol === "https:" ||
      (url.protocol === "http:" && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Invalid Yahoo redirect URI");
  }
}

export class YahooAuthorizationFlow {
  private pending: PendingAuthorization | null = null;

  constructor(
    private readonly clientId: string,
    private readonly redirectUri: string,
    private readonly now: () => number = Date.now,
  ) {
    if (!clientId.trim()) {
      throw new Error("Missing Yahoo client ID");
    }

    validateRedirectUri(redirectUri);
  }

  createAuthorizationUrl(): string {
    const state = randomBytes(32).toString("base64url");

    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);

    this.pending = {
      state,
      createdAt: this.now(),
    };

    return url.toString();
  }

  consumeCallback(callbackUrl: string): string {
    const pending = this.pending;

    if (!pending) {
      throw new Error("No pending Yahoo authorization");
    }

    const callback = new URL(callbackUrl);
    const expected = new URL(this.redirectUri);

    if (
      callback.origin !== expected.origin ||
      callback.pathname !== expected.pathname ||
      callback.hash
    ) {
      throw new Error("Yahoo callback URI mismatch");
    }

    const states = callback.searchParams.getAll("state");

    if (states.length !== 1) {
      throw new Error("Invalid Yahoo OAuth state");
    }

    const received = Buffer.from(states[0]!);
    const original = Buffer.from(pending.state);

    if (
      received.length !== original.length ||
      !timingSafeEqual(received, original)
    ) {
      throw new Error("Yahoo OAuth state mismatch");
    }

    const age = this.now() - pending.createdAt;

    if (age < 0 || age > MAX_AGE_MS) {
      this.pending = null;
      throw new Error("Yahoo authorization expired");
    }

    if (callback.searchParams.has("error")) {
      this.pending = null;
      throw new Error("Yahoo authorization denied or failed");
    }

    const codes = callback.searchParams.getAll("code");

    if (codes.length !== 1 || !codes[0]!.trim()) {
      throw new Error("Missing or invalid Yahoo authorization code");
    }

    // An authorization attempt can be consumed only once.
    this.pending = null;

    return codes[0]!;
  }
}
