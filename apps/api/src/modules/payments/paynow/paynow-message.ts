import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Paynow wire format (developers.paynow.co.zw, "Generating Hash"): URL-encoded
 * `name=value` pairs. The hash is the upper-case hex SHA-512 of every value in
 * the order sent (URL-decoded, `hash` itself left out) followed by the
 * integration key. Names are not hashed and order matters, so messages are
 * kept as ordered lists, never plain objects.
 */
export type PaynowField = readonly [name: string, value: string];

const HASH_PATTERN = /^[0-9a-f]{128}$/i;

export const paynowHash = (values: readonly string[], integrationKey: string): string =>
  createHash('sha512').update(values.join('') + integrationKey, 'utf8').digest('hex').toUpperCase();

const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, '+');
const decode = (value: string) => decodeURIComponent(value.replace(/\+/g, ' '));

/** Request body for Paynow: the fields in order, then their hash. */
export const signPaynowMessage = (fields: readonly PaynowField[], integrationKey: string): string => {
  if (fields.some(([name]) => name.toLowerCase() === 'hash')) throw new Error('hash is added by signPaynowMessage');
  const hash = paynowHash(fields.map(([, value]) => value), integrationKey);
  return [...fields, ['hash', hash] as const].map(([name, value]) => `${encode(name)}=${encode(value)}`).join('&');
};

/** Ordered fields with lower-cased names, or null if the text is not a clean pair list (or repeats a field). */
export const parsePaynowMessage = (text: string): PaynowField[] | null => {
  const body = text.trim();
  if (!body) return null;
  const fields: PaynowField[] = [];
  const seen = new Set<string>();
  for (const pair of body.split('&')) {
    const at = pair.indexOf('=');
    if (at <= 0) return null;
    let name: string;
    let value: string;
    try {
      name = decode(pair.slice(0, at)).toLowerCase();
      value = decode(pair.slice(at + 1));
    } catch {
      return null;
    }
    if (seen.has(name)) return null;
    seen.add(name);
    fields.push([name, value]);
  }
  return fields;
};

/** True only when the message carries a hash that matches its values and our integration key. */
export const verifyPaynowHash = (fields: readonly PaynowField[], integrationKey: string): boolean => {
  const received = fields.find(([name]) => name === 'hash')?.[1];
  if (!received || !HASH_PATTERN.test(received)) return false;
  const expected = paynowHash(fields.filter(([name]) => name !== 'hash').map(([, value]) => value), integrationKey);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received.toUpperCase(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
};

export const fieldValue = (fields: readonly PaynowField[], name: string): string | undefined =>
  fields.find(([field]) => field === name)?.[1];
