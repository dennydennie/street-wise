/**
 * Origin allow-lists shared by CORS and WebAuthn. An entry is an exact origin
 * (`https://streetwise.co.zw`, `android:apk-key-hash:…`) or, outside
 * production only (env.schema.ts refuses it there), a loopback host with a
 * port wildcard: `http://localhost:*` / `http://127.0.0.1:*`.
 */
export type OriginMatcher = (origin: string) => boolean;

const WILDCARD = /^(https?:\/\/(?:localhost|127\.0\.0\.1)):\*$/;
const LOOPBACK_ANY_PORT = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

export const createOriginMatcher = (entries: readonly string[], options: { allowAnyLoopback?: boolean } = {}): OriginMatcher => {
  const exact = new Set<string>();
  const prefixes: string[] = [];
  for (const entry of entries) {
    const wildcard = WILDCARD.exec(entry);
    if (wildcard) prefixes.push(wildcard[1]);
    else exact.add(entry);
  }
  return (origin: string) => {
    if (exact.has(origin)) return true;
    if (options.allowAnyLoopback && LOOPBACK_ANY_PORT.test(origin)) return true;
    return prefixes.some((prefix) => origin === prefix || new RegExp(`^${escape(prefix)}:\\d{1,5}$`).test(origin));
  };
};

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** CORS: the configured list, plus any http://localhost:<port> / 127.0.0.1 (Flutter web dev) outside production. */
export const corsOriginMatcher = (config: { corsOrigins: string[]; isProduction: boolean }): OriginMatcher =>
  createOriginMatcher(config.corsOrigins, { allowAnyLoopback: !config.isProduction });

/**
 * Android Credential Manager sends `android:apk-key-hash:<base64url SHA-256 of the signing cert>`
 * as the WebAuthn origin; it is derived from the same fingerprints assetlinks.json publishes.
 */
export const androidApkKeyHashOrigin = (fingerprint: string): string =>
  `android:apk-key-hash:${Buffer.from(fingerprint.replace(/:/g, ''), 'hex').toString('base64url')}`;
