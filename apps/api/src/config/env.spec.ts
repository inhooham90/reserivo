import { describe, expect, it } from 'vitest';
import { siteAdminEmails } from './env.js';

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
