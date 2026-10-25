import { Entry } from "@napi-rs/keyring";

const SERVICE = "fantasy-basketball-weekly-report.yahoo";

export type YahooCredential =
  | "client-secret"
  | "refresh-token";

export interface KeychainEntry {
  getPassword(): string | null;
  setPassword(password: string): void;
}

export type KeychainEntryFactory = (
  service: string,
  account: string,
) => KeychainEntry;

export class YahooKeychainStore {
  constructor(
    private readonly scope: string,
    private readonly createEntry: KeychainEntryFactory =
      (service, account) => new Entry(service, account),
  ) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scope)) {
      throw new Error("Invalid Yahoo credential scope");
    }
  }

  private entry(kind: YahooCredential): KeychainEntry {
    return this.createEntry(
      SERVICE,
      `${this.scope}:${kind}`,
    );
  }

  read(kind: YahooCredential): string {
    try {
      const value = this.entry(kind).getPassword();

      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    } catch {
      // Do not expose native errors containing credential details.
    }

    throw new Error(
      `Yahoo ${kind} unavailable in secure credential storage`,
    );
  }

  write(kind: YahooCredential, value: string): void {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("Cannot store an empty Yahoo credential");
    }

    try {
      this.entry(kind).setPassword(value);
    } catch {
      throw new Error(
        `Failed to securely store Yahoo ${kind}`,
      );
    }
  }

  saveRefreshToken = async (token: string): Promise<void> => {
    this.write("refresh-token", token);
  };
}
