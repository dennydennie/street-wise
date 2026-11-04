import { androidApkKeyHashOrigin, corsOriginMatcher, createOriginMatcher } from './origins';

describe('origin matchers', () => {
  it('CORS allows configured origins and, outside production, any loopback port', () => {
    const dev = corsOriginMatcher({ corsOrigins: ['https://streetwise.co.zw'], isProduction: false });
    expect(dev('https://streetwise.co.zw')).toBe(true);
    expect(dev('http://localhost:53124')).toBe(true);
    expect(dev('http://127.0.0.1:8080')).toBe(true);
    expect(dev('https://evil.example')).toBe(false);
    expect(dev('http://localhost.evil.example')).toBe(false);
  });

  it('CORS refuses localhost in production unless listed', () => {
    const prod = corsOriginMatcher({ corsOrigins: ['https://streetwise.co.zw'], isProduction: true });
    expect(prod('http://localhost:53124')).toBe(false);
    expect(prod('https://streetwise.co.zw')).toBe(true);
  });

  it('supports a port wildcard for localhost entries only', () => {
    const match = createOriginMatcher(['http://localhost:*', 'android:apk-key-hash:abc']);
    expect(match('http://localhost:4100')).toBe(true);
    expect(match('http://localhost:4100/path')).toBe(false);
    expect(match('http://127.0.0.1:4100')).toBe(false);
    expect(match('android:apk-key-hash:abc')).toBe(true);
  });

  it('derives the Android WebAuthn origin from a signing-cert fingerprint', () => {
    const fingerprint = Array.from({ length: 32 }, () => 'AB').join(':');
    expect(androidApkKeyHashOrigin(fingerprint)).toBe(`android:apk-key-hash:${Buffer.alloc(32, 0xab).toString('base64url')}`);
  });
});
