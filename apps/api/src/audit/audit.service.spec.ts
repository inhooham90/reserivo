import { describe, expect, it } from 'vitest';
import { redact } from './audit.service.js';

describe('redact', () => {
  it('replaces values under sensitive-looking keys at any depth', () => {
    const input = {
      email: 'a@b.c',
      password: 'hunter2',
      nested: { accessToken: 'abc', refresh_token: 'def', keep: 1 },
      list: [{ secret: 'x' }, { ok: 'y' }],
    };
    expect(redact(input)).toEqual({
      email: 'a@b.c',
      password: '[redacted]',
      nested: { accessToken: '[redacted]', refresh_token: '[redacted]', keep: 1 },
      list: [{ secret: '[redacted]' }, { ok: 'y' }],
    });
  });

  it('matches Authorization and Cookie header names case-insensitively', () => {
    expect(redact({ Authorization: 'Bearer x', COOKIE: 'a=b' })).toEqual({
      Authorization: '[redacted]',
      COOKIE: '[redacted]',
    });
  });

  it('passes primitives and null through untouched', () => {
    expect(redact('plain')).toBe('plain');
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  it('does not mutate its input', () => {
    const input = { password: 'p', inner: { token: 't' } };
    redact(input);
    expect(input).toEqual({ password: 'p', inner: { token: 't' } });
  });

  it('stops descending past the depth limit instead of recursing forever', () => {
    type Deep = { a?: Deep; password?: string };
    const deep: Deep = {};
    let cursor = deep;
    for (let i = 0; i < 10; i++) {
      cursor.a = {};
      cursor = cursor.a;
    }
    cursor.password = 'leaf';
    // The leaf is beyond depth 6; it comes back as-is rather than redacted, and nothing throws.
    expect(() => redact(deep)).not.toThrow();
  });
});
