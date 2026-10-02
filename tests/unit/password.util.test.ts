import { describe, it, expect } from 'vitest';
import { PasswordUtil } from '../../src/modules/auth/utils/password.util';

describe('PasswordUtil (Argon2id)', () => {
  it('should hash a password with a valid Argon2 salt and format', async () => {
    const rawPassword = 'StrongP@ssw0rd!';
    const hash = await PasswordUtil.hash(rawPassword);

    expect(hash).toBeDefined();
    expect(hash).toContain('$argon2id$');
  });

  it('should verify matching plaintext password against the hash', async () => {
    const rawPassword = 'SecurePassword123#';
    const hash = await PasswordUtil.hash(rawPassword);

    const isMatch = await PasswordUtil.verify(hash, rawPassword);
    expect(isMatch).toBe(true);
  });

  it('should reject non-matching password', async () => {
    const rawPassword = 'CorrectPassword1!';
    const wrongPassword = 'WrongPassword2@';
    const hash = await PasswordUtil.hash(rawPassword);

    const isMatch = await PasswordUtil.verify(hash, wrongPassword);
    expect(isMatch).toBe(false);
  });
});
