import { describe, expect, it } from 'vitest';
import { siteAdminEmails, validateEnv } from './env.js';

describe('siteAdminEmails', () => {
  it('splits a comma-separated list, trimming and lowercasing', () => {
    expect(siteAdminEmails('  Ada@Example.com , bob@example.com ')).toEqual(['ada@example.com', 'bob@example.com']);
  });

  it('treats unset, empty and separator-only values as nobody', () => {
    // Compose passes `${VAR:-}` as an empty string, so these must not yield [''].
    expect(siteAdminEmails(undefined)).toEqual([]);
    expect(siteAdminEmails('')).toEqual([]);
    expect(siteAdminEmails('  ')).toEqual([]);
    expect(siteAdminEmails(',,')).toEqual([]);
  });

  it('keeps a single address intact', () => {
    expect(siteAdminEmails('james@akkija.com')).toEqual(['james@akkija.com']);
  });
});

describe('Stripe config', () => {
  const base = { DATABASE_URL: 'postgres://u:p@localhost:5433/db', JWT_ACCESS_SECRET: 'x'.repeat(16), JWT_REFRESH_SECRET: 'y'.repeat(16) };

  it('is optional: unset (or compose\'s empty strings) means billing off', () => {
    expect(validateEnv({ ...base, STRIPE_SECRET_KEY: '', STRIPE_PRICE_ID: '' }).STRIPE_SECRET_KEY).toBeUndefined();
  });

  it('refuses a secret key without the price and webhook secret', () => {
    expect(() => validateEnv({ ...base, STRIPE_SECRET_KEY: 'sk_test_1' })).toThrow(/STRIPE_PRICE_ID[\s\S]*STRIPE_WEBHOOK_SECRET/);
  });

  it('accepts a complete set, with the intro coupon optional', () => {
    expect(() => validateEnv({ ...base, STRIPE_SECRET_KEY: 'sk_test_1', STRIPE_PRICE_ID: 'price_1', STRIPE_WEBHOOK_SECRET: 'whsec_1' })).not.toThrow();
  });
});
