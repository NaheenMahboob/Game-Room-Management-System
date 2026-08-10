/**
 * Member age and time helpers (minor check, elapsed minutes).
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */

/**
 * Whole years of age on a given calendar date (birthday-aware).
 *
 * @param dateOfBirth - Birth date
 * @param on - Date to measure age against
 */
export function ageYearsOn(dateOfBirth: Date, on: Date): number {
  let age = on.getFullYear() - dateOfBirth.getFullYear();
  const m = on.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age;
}

/** True when the person is under 18 years old on the current calendar date. */
export function isMinor(dateOfBirth: Date | null | undefined): boolean {
  if (!dateOfBirth) return false;
  return ageYearsOn(dateOfBirth, new Date()) < 18;
}

/**
 * True when the account was created for a minor (under 18 at registration)
 * and that person is now 18 or older. Those accounts must be deleted and
 * re-registered as adults (waiver / consent are different).
 *
 * @param dateOfBirth - Member DOB (null → never age-expires this way)
 * @param registeredAt - Member.createdAt
 */
export function isMinorRegistrationAgeExpired(
  dateOfBirth: Date | null | undefined,
  registeredAt: Date
): boolean {
  if (!dateOfBirth) return false;
  if (ageYearsOn(dateOfBirth, registeredAt) >= 18) return false;
  return ageYearsOn(dateOfBirth, new Date()) >= 18;
}

/** Login / portal copy when a minor registration has aged out. */
export const AGE_EXPIRED_LOGIN_MESSAGE =
  "This account was created while you were under 18 and can no longer be used. Ask an admin to delete your account, then register again as an adult.";

/**
 * Whole minutes elapsed from `from` to `to` (default now), never negative.
 *
 * @param from - Start timestamp
 * @param to - End timestamp (defaults to current time)
 */
export function minutesBetween(from: Date, to: Date = new Date()): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60000));
}
