import { z } from "zod";
import { ConditionStatus, EquipmentType } from "@prisma/client";

export const registerMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().optional().or(z.literal("")),
  emergencyContactName: z.string().trim().min(2).max(120),
  emergencyContactPhone: z.string().trim().min(7).max(30),
  photoUrl: z.string().trim().min(1),
  dateOfBirth: z.string().optional(),
  waiverSigned: z.literal(true),
  waiverSignature: z.string().trim().min(1),
  parentalConsent: z.boolean().default(false),
});

export const memberSearchSchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const updateMemberSchema = z.object({
  phone: z.string().trim().min(7).max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal("")).optional(),
  emergencyContactName: z.string().trim().min(2).max(120).optional(),
  emergencyContactPhone: z.string().trim().min(7).max(30).optional(),
  membershipStatus: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const signInSchema = z.object({
  memberId: z.string().cuid(),
});

export const signOutSchema = z.object({
  memberId: z.string().cuid(),
  forceReturnEquipment: z.boolean().optional().default(false),
});

export const borrowSchema = z.object({
  memberId: z.string().cuid(),
  equipmentIds: z.array(z.string().cuid()).min(1).max(20),
});

export const returnLoanSchema = z.object({
  loanId: z.string().cuid().optional(),
  loanIds: z.array(z.string().cuid()).optional(),
  memberId: z.string().cuid().optional(),
  returnAll: z.boolean().optional(),
  conditionNotes: z.string().trim().max(2000).optional(),
});

export const conditionUpdateSchema = z.object({
  conditionStatus: z.nativeEnum(ConditionStatus),
  notes: z.string().trim().max(2000).optional(),
});

export const queueJoinSchema = z.object({
  equipmentId: z.string().cuid(),
  memberId: z.string().cuid(),
});

export const guestPassSchema = z.object({
  hostMemberId: z.string().cuid(),
  guestName: z.string().trim().min(2).max(120),
  guestPhone: z.string().trim().min(7).max(30),
});

export const equipmentListSchema = z.object({
  type: z.nativeEnum(EquipmentType).optional(),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
