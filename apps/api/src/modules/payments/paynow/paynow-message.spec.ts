import { createHash } from 'node:crypto';
import { paynowHash, parsePaynowMessage, signPaynowMessage, verifyPaynowHash } from './paynow-message';

const key = 'integration-key-under-test';

const resultBody = (overrides: Record<string, string> = {}) =>
  signPaynowMessage(
    Object.entries({
      reference: 'SWZ-7Q4K2M',
      paynowreference: '1234567',
      amount: '1.50',
      status: 'Paid',
      pollurl: 'https://www.paynow.co.zw/Interface/CheckPayment/?guid=abc',
      ...overrides,
    }),
    key,
  );

describe('Paynow hash', () => {
  it('is SHA-512 over the values in order plus the key, upper-case hex', () => {
    const expected = createHash('sha512').update('a b' + 'c' + key).digest('hex').toUpperCase();
    expect(paynowHash(['a b', 'c'], key)).toBe(expected);
  });

  it('verifies a correctly signed result callback', () => {
    const fields = parsePaynowMessage(resultBody());
    expect(fields).not.toBeNull();
    expect(verifyPaynowHash(fields!, key)).toBe(true);
  });

  it('rejects a callback signed with another key', () => {
    const fields = parsePaynowMessage(signPaynowMessage([['status', 'Paid']], 'someone-elses-key'));
    expect(verifyPaynowHash(fields!, key)).toBe(false);
  });

  it('rejects a tampered status', () => {
    const tampered = resultBody().replace('status=Paid', 'status=Cancelled');
    expect(verifyPaynowHash(parsePaynowMessage(tampered)!, key)).toBe(false);
  });

  it('rejects a tampered amount', () => {
    const tampered = resultBody().replace('amount=1.50', 'amount=0.50');
    expect(verifyPaynowHash(parsePaynowMessage(tampered)!, key)).toBe(false);
  });

  it('rejects a message with no hash', () => {
    expect(verifyPaynowHash(parsePaynowMessage('reference=SWZ-7Q4K2M&status=Paid')!, key)).toBe(false);
  });

  it('refuses repeated fields instead of guessing', () => {
    expect(parsePaynowMessage('status=Paid&status=Cancelled')).toBeNull();
  });
});
