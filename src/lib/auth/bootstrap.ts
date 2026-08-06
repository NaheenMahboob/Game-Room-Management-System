/**
 * Bootstrap admin helpers — the account seeded from `ADMIN_EMAIL`.
 * That account is the only one allowed to change other ADMIN roles.
 *
 * @author Muhammad Naheen Mahboob
 */

/**
 * Normalized bootstrap admin email from env (default seed address).
 *
 * @returns Lowercased `ADMIN_EMAIL`, or the seed default when unset
 * @author Muhammad Naheen Mahboob
 */
export function bootstrapAdminEmail(): string {
  // Compare emails case-insensitively everywhere this helper is used.
  return (process.env.ADMIN_EMAIL ?? "admin@mosque.local").toLowerCase();
}

/**
 * True when this email is the seeded / env bootstrap admin account.
 *
 * @param email - Candidate account email
 * @author Muhammad Naheen Mahboob
 */
export function isBootstrapAdminEmail(email: string): boolean {
  return email.toLowerCase() === bootstrapAdminEmail();
}
