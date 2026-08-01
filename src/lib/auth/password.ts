/**
 * bcrypt password hashing and verification for user accounts.
 */

import bcrypt from "bcryptjs";

/** bcrypt cost factor for new password hashes. */
const ROUNDS = 12;

/**
 * Hashes a plaintext password for storage on `User.passwordHash`.
 *
 * @param password - Plaintext password from registration or change-password
 * @returns bcrypt hash string
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

/**
 * Compares a login password against a stored hash.
 *
 * @param password - Plaintext password from login
 * @param passwordHash - Stored bcrypt hash
 * @returns `true` when the password matches
 */
export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
