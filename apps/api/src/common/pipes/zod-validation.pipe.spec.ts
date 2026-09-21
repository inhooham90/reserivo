import { BadRequestException } from '@nestjs/common';
import { registerSchema } from '@reserivo/shared';
import { describe, expect, it } from 'vitest';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(registerSchema);

  it('returns the parsed (transformed) value on success', () => {
    const out = pipe.transform({ email: '  Jane@Example.COM ', password: 'longenough', name: ' Jane ' });
    expect(out).toEqual({ email: 'jane@example.com', password: 'longenough', name: 'Jane' });
  });

  it('throws a 400 with one issue per failing field', () => {
    let caught: unknown;
    try {
      pipe.transform({ email: 'nope', password: 'short', name: '' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    const body = (caught as BadRequestException).getResponse() as { message: string; issues: { path: string }[] };
    expect(body.message).toBe('Validation failed');
    expect(body.issues.map((i) => i.path).sort()).toEqual(['email', 'name', 'password']);
  });

  it('rejects unknown shapes rather than passing them through', () => {
    expect(() => pipe.transform(null)).toThrow(BadRequestException);
    expect(() => pipe.transform('string')).toThrow(BadRequestException);
  });
});
