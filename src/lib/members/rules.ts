/**
 * Member age and time helpers (minor check, elapsed minutes).
 */

/** True when the person is under 18 years old on the current calendar date. */
export function isMinor(dateOfBirth: Date | null | undefined): boolean {
  if (!dateOfBirth) return false;
  const now = new Date();
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const m = now.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age < 18;
}

/**
 * Whole minutes elapsed from `from` to `to` (default now), never negative.
 *
 * @param from - Start timestamp
 * @param to - End timestamp (defaults to current time)
 */
export function minutesBetween(from: Date, to: Date = new Date()): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60000));
}
