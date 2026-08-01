import { randomBytes } from "crypto";
import { nanoid } from "nanoid";

export function generateQrPayload(): string {
  return `m_${nanoid(16)}`;
}

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
