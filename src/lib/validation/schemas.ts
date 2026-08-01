/**
 * Zod request schemas for API route validation.
 * Registration `photoUrl` must be a private storage filename (uploaded first).
 * Sign-in requires explicit staff photo verification.
 */

import { z } from "zod";

/** Equipment condition values accepted on condition-update routes. */
const conditionStatusEnum = z.enum(["GOOD", "MINOR_ISSUE", "OUT_OF_ORDER"]);

/** Equipment category values for list/filter requests. */
const equipmentTypeEnum = z.enum([
  "PS5_CONSOLE",
  "PS5_CONTROLLER",
  "SWITCH_CONSOLE",
  "SWITCH_CONTROLLER",
  "TABLE_TENNIS",
  "FOOSBALL",
  "POOL",
  "AIR_HOCKEY",
]);

/** Body for `POST /api/members` after the photo has been uploaded to disk. */
export const registerMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().optional().or(z.literal("")),
  emergencyContactName: z.string().trim().min(2).max(120),
  emergencyContactPhone: z.string().trim().min(7).max(30),
  // Storage filename only — never a public URL or data: URL.
  photoUrl: z
    .string()
    .trim()
    .regex(/^[\w.-]+\.(jpe?g|png|webp)$/i, "Invalid photo filename"),
  dateOfBirth: z.string().optional(),
  waiverSigned: z.literal(true),
  waiverSignature: z.string().trim().min(1),
  parentalConsent: z.boolean().default(false),
});

/**
 * Public self-registration: same fields as desk register plus required email/password.
 * Creates a PENDING member until staff verifies the photo.
 */
export const selfRegisterMemberSchema = registerMemberSchema.extend({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

/** Change password after admin reset / forced update. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

/** Query params for desk member search (waiting + currently inside). */
export const memberSearchSchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/** Partial profile update (photo changes use the dedicated photo endpoint). */
export const updateMemberSchema = z.object({
  phone: z.string().trim().min(7).max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal("")).optional(),
  emergencyContactName: z.string().trim().min(2).max(120).optional(),
  emergencyContactPhone: z.string().trim().min(7).max(30).optional(),
  membershipStatus: z.enum(["PENDING", "ACTIVE", "INACTIVE"]).optional(),
});

/**
 * Body for `POST /api/attendance/sign-in`.
 * `photoVerified` must be the literal `true` — staff confirmed the desk photo.
 */
export const signInSchema = z.object({
  memberId: z.string().cuid(),
  photoVerified: z.literal(true),
});

/** Body for `POST /api/attendance/sign-out`. */
export const signOutSchema = z.object({
  memberId: z.string().cuid(),
  forceReturnEquipment: z.boolean().optional().default(false),
});

/** Body for equipment borrow (one or more items for a member). */
export const borrowSchema = z.object({
  memberId: z.string().cuid(),
  equipmentIds: z.array(z.string().cuid()).min(1).max(20),
});

/** Body for returning loans by id, member, or return-all flag. */
export const returnLoanSchema = z.object({
  loanId: z.string().cuid().optional(),
  loanIds: z.array(z.string().cuid()).optional(),
  memberId: z.string().cuid().optional(),
  returnAll: z.boolean().optional(),
  conditionNotes: z.string().trim().max(2000).optional(),
});

/** Body for updating an equipment item's condition status and notes. */
export const conditionUpdateSchema = z.object({
  conditionStatus: conditionStatusEnum,
  notes: z.string().trim().max(2000).optional(),
});

/** Body for joining the wait queue for a piece of equipment. */
export const queueJoinSchema = z.object({
  equipmentId: z.string().cuid(),
  memberId: z.string().cuid(),
});

/** Body for issuing a guest pass tied to a host member. */
export const guestPassSchema = z.object({
  hostMemberId: z.string().cuid(),
  guestName: z.string().trim().min(2).max(120),
  guestPhone: z.string().trim().min(7).max(30),
});

/** Query params for listing equipment (optional type and inactive filter). */
export const equipmentListSchema = z.object({
  type: equipmentTypeEnum.optional(),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
