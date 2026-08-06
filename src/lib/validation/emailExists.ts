/**
 * Registration email domain checks (no outbound mail).
 * Zod handles format; this module rejects disposable domains and domains
 * without MX records so fake / throwaway addresses cannot be used at signup.
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */

import { resolveMx } from "node:dns/promises";

/**
 * Common disposable / throwaway email domains (lowercase).
 * Not exhaustive — blocks the usual suspects used to spam signup.
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "grr.la",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "yopmail.com",
  "trashmail.com",
  "discard.email",
  "getnada.com",
  "fakeinbox.com",
  "maildrop.cc",
  "throwaway.email",
  "tempail.com",
  "emailondeck.com",
  "moakt.com",
]);

/**
 * Domains that never have public MX (local/dev); skip DNS when matched.
 *
 * @param domain - Host part of an email address (lowercase)
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
function isLocalOrReservedDomain(domain: string): boolean {
  return (
    domain === "localhost" ||
    domain.endsWith(".localhost") ||
    domain.endsWith(".local") ||
    domain.endsWith(".test") ||
    domain.endsWith(".invalid")
  );
}

/**
 * Asserts the email domain is not disposable and (unless local/dev) has MX records.
 * Set `EMAIL_MX_CHECK=false` to skip DNS (e.g. offline CI).
 *
 * @param email - Already trimmed; compared case-insensitively for the domain
 * @throws Error with a user-facing message when validation fails
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
export async function assertEmailDomainAcceptsMail(
  email: string
): Promise<void> {
  const at = email.lastIndexOf("@");
  if (at < 1) {
    throw new Error("Invalid email address");
  }

  // Domain only — local-part is not validated beyond Zod's email rule upstream.
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain || domain.includes(" ")) {
    throw new Error("Invalid email address");
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    throw new Error(
      "Please use a permanent email address (disposable addresses are not allowed)"
    );
  }

  // Explicit opt-out for environments without DNS (CI / air-gapped).
  if (process.env.EMAIL_MX_CHECK === "false") {
    return;
  }

  // Seed / desk synthetic logins use `.local` and cannot resolve public MX.
  if (isLocalOrReservedDomain(domain)) {
    return;
  }

  try {
    const records = await resolveMx(domain);
    // Empty MX list means the domain is not configured to receive mail.
    if (!records?.length) {
      throw new Error("Email domain does not accept mail");
    }
  } catch (err) {
    // Preserve our own message; map DNS failures to a generic user-facing error.
    if (
      err instanceof Error &&
      err.message === "Email domain does not accept mail"
    ) {
      throw err;
    }
    throw new Error(
      "Email domain could not be verified. Check the address and try again."
    );
  }
}
