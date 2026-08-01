/**
 * Member QR payload and temporary password generators.
 */

import { randomBytes } from "crypto";
import { nanoid } from "nanoid";

/** Creates a unique QR scan value prefixed with `m_`. */
export function generateQrPayload(): string {
  return `m_${nanoid(16)}`;
}

/**
 * Generates a random temporary password using an unambiguous character alphabet.
 *
 * @param length - Number of characters (default 12)
 */
export function generateTempPassword(length = 12): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}
