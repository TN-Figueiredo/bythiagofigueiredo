import { describe, it, expect } from 'vitest';
import { redactThirdPartyPii } from './redact-third-party-pii';

describe('redactThirdPartyPii', () => {
  it('redacts emails', () => {
    const r = redactThirdPartyPii('contact joao@example.com for details');
    expect(r.text).toBe('contact [REDACTED_EMAIL] for details');
    expect(r.redacted).toBe(true);
  });
  it('redacts phones', () => {
    const r = redactThirdPartyPii('call +55 11 99876 1234');
    expect(r.text).toContain('[REDACTED_PHONE]');
    expect(r.redacted).toBe(true);
  });
  it('returns unredacted text with flag false', () => {
    const r = redactThirdPartyPii('hello world');
    expect(r.text).toBe('hello world');
    expect(r.redacted).toBe(false);
  });
  it('handles null', () => {
    const r = redactThirdPartyPii(null);
    expect(r.text).toBeNull();
    expect(r.redacted).toBe(false);
  });
  it('handles empty string as unredacted null-like', () => {
    const r = redactThirdPartyPii('');
    expect(r.text).toBeNull();
    expect(r.redacted).toBe(false);
  });
  it('redacts multiple emails and phones in same text', () => {
    const r = redactThirdPartyPii('a@x.com +55 11 99876 1234 b@y.com');
    expect(r.text).toBe('[REDACTED_EMAIL] [REDACTED_PHONE] [REDACTED_EMAIL]');
    expect(r.redacted).toBe(true);
  });
});
