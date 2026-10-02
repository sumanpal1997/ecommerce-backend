import argon2 from 'argon2';

/**
 * Utility for hashing and verifying passwords using the Argon2id algorithm.
 * Argon2id provides superior resistance against GPU/ASIC cracking attacks
 * by enforcing memory hardness alongside CPU complexity.
 */
export class PasswordUtil {
  public static async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,         // 3 iterations
      parallelism: 1,
    });
  }

  public static async verify(hash: string, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainText);
    } catch {
      return false;
    }
  }
}
