/**
 * Member search, registration, profile updates, and pending approval workflows.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { generateQrPayload, generateTempPassword } from "@/lib/members/ids";
import { isMinor } from "@/lib/members/rules";
import { getCurrentWaiverVersion } from "@/lib/settings";
import {
  deleteMemberPhotoIfStored,
  withClientPhotoUrl,
} from "@/lib/uploads/memberPhoto";
import type { z } from "zod";
import type {
  registerMemberSchema,
  selfRegisterMemberSchema,
  updateMemberSchema,
} from "@/lib/validation/schemas";

/**
 * Searches members by name or phone and returns client-safe photo API URLs.
 *
 * @param q - Search query
 * @param limit - Max rows to return
 */
export async function searchMembers(q: string, limit = 20) {
  const members = await prisma.member.findMany({
    where: {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    take: limit,
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      phone: true,
      photoUrl: true,
      pendingPhotoUrl: true,
      membershipStatus: true,
      qrPayload: true,
      userId: true,
    },
  });
  return members.map(withClientPhotoUrl);
}

/**
 * Loads a member profile (open attendance + active loans) with a private photo URL.
 *
 * @param id - Member cuid
 */
export async function getMemberById(id: string) {
  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, role: true } },
      attendances: {
        where: { signOutTime: null },
        take: 1,
        orderBy: { signInTime: "desc" },
      },
      loans: {
        where: { returnedAt: null },
        include: { equipment: true },
      },
    },
  });
  return member ? withClientPhotoUrl(member) : null;
}

/**
 * Looks up a member by QR payload with a private photo URL for desk display.
 *
 * @param qrPayload - Scanned QR value
 */
export async function getMemberByQr(qrPayload: string) {
  const member = await prisma.member.findUnique({
    where: { qrPayload },
    include: {
      user: { select: { id: true, email: true, role: true } },
      attendances: {
        where: { signOutTime: null },
        take: 1,
        orderBy: { signInTime: "desc" },
      },
      loans: {
        where: { returnedAt: null },
        include: { equipment: true },
      },
    },
  });
  return member ? withClientPhotoUrl(member) : null;
}

type RegisterInput = z.infer<typeof registerMemberSchema>;
type SelfRegisterInput = z.infer<typeof selfRegisterMemberSchema>;

async function assertUniquePhoneAndEmail(phone: string, email: string) {
  const existingPhone = await prisma.member.findUnique({ where: { phone } });
  if (existingPhone) {
    throw new Error("A member with this phone number already exists.");
  }
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new Error("A user with this email already exists.");
  }
}

/**
 * Desk registration by volunteer/admin — ACTIVE immediately (photo verified in person).
 *
 * @param input - Validated registration payload (`photoUrl` = storage filename)
 * @param registeredByUserId - Staff user performing registration
 */
export async function registerMember(
  input: RegisterInput,
  registeredByUserId: string
) {
  const waiverVersion = await getCurrentWaiverVersion();
  const email =
    input.email && input.email.length > 0
      ? input.email.toLowerCase()
      : `member+${Date.now()}@mosque.local`;

  const dob = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  if (dob && isMinor(dob) && !input.parentalConsent) {
    throw new Error(
      "Parental consent is required for members under 18 before registration can complete."
    );
  }

  await assertUniquePhoneAndEmail(input.phone, email);

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const qrPayload = generateQrPayload();

  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: "MEMBER",
          mustChangePassword: true,
        },
      });

      const member = await tx.member.create({
        data: {
          userId: user.id,
          fullName: input.fullName,
          phone: input.phone,
          email: input.email && input.email.length > 0 ? input.email : null,
          emergencyContactName: input.emergencyContactName,
          emergencyContactPhone: input.emergencyContactPhone,
          photoUrl: input.photoUrl,
          membershipStatus: "ACTIVE",
          dateOfBirth: dob,
          waiverSigned: true,
          waiverSignedAt: new Date(),
          waiverVersion,
          parentalConsent: dob && isMinor(dob) ? input.parentalConsent : true,
          qrPayload,
          registeredByUserId,
          approvedByUserId: registeredByUserId,
          approvedAt: new Date(),
        },
      });

      await writeAuditLog(
        {
          actionType: AuditAction.MEMBER_REGISTERED,
          performedByUserId: registeredByUserId,
          memberId: member.id,
          details: {
            fullName: member.fullName,
            phone: member.phone,
            waiverVersion,
            waiverSignature: input.waiverSignature,
            source: "desk",
          },
        },
        tx
      );

      return { user, member };
    }
  );

  return {
    member: withClientPhotoUrl(result.member),
    temporaryPassword: tempPassword,
    loginEmail: email,
  };
}

/**
 * Member self-registration — PENDING until staff verifies the uploaded photo.
 *
 * @param input - Form fields including password and photo filename
 */
export async function selfRegisterMember(input: SelfRegisterInput) {
  const waiverVersion = await getCurrentWaiverVersion();
  const email = input.email.toLowerCase();
  const dob = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  if (dob && isMinor(dob) && !input.parentalConsent) {
    throw new Error(
      "Parental consent is required for members under 18 before registration can complete."
    );
  }

  await assertUniquePhoneAndEmail(input.phone, email);

  const passwordHash = await hashPassword(input.password);
  const qrPayload = generateQrPayload();

  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: "MEMBER",
          mustChangePassword: false,
        },
      });

      // Self-registered: registeredBy points at the new user until staff approves.
      const member = await tx.member.create({
        data: {
          userId: user.id,
          fullName: input.fullName,
          phone: input.phone,
          email,
          emergencyContactName: input.emergencyContactName,
          emergencyContactPhone: input.emergencyContactPhone,
          photoUrl: input.photoUrl,
          membershipStatus: "PENDING",
          dateOfBirth: dob,
          waiverSigned: true,
          waiverSignedAt: new Date(),
          waiverVersion,
          parentalConsent: dob && isMinor(dob) ? input.parentalConsent : true,
          qrPayload,
          registeredByUserId: user.id,
        },
      });

      await writeAuditLog(
        {
          actionType: AuditAction.MEMBER_REGISTERED,
          performedByUserId: user.id,
          memberId: member.id,
          details: {
            fullName: member.fullName,
            phone: member.phone,
            waiverVersion,
            source: "self",
            pendingPhotoVerification: true,
          },
        },
        tx
      );

      return { user, member };
    }
  );

  return {
    member: withClientPhotoUrl(result.member),
    loginEmail: email,
  };
}

/**
 * Lists members awaiting staff photo verification.
 */
export async function listPendingMembers() {
  const members = await prisma.member.findMany({
    where: { membershipStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, email: true } },
    },
  });
  return members.map((m) => withClientPhotoUrl(m));
}

/**
 * Approves a PENDING self-registration after staff reviews the photo.
 *
 * @param memberId - Pending member id
 * @param approvedByUserId - Volunteer/admin performing approval
 */
export async function approveMemberRegistration(
  memberId: string,
  approvedByUserId: string
) {
  const existing = await prisma.member.findUnique({ where: { id: memberId } });
  if (!existing) throw new Error("Member not found");
  if (existing.membershipStatus !== "PENDING") {
    throw new Error("Member is not awaiting verification");
  }

  const member = await prisma.member.update({
    where: { id: memberId },
    data: {
      membershipStatus: "ACTIVE",
      approvedByUserId,
      approvedAt: new Date(),
    },
  });

  await writeAuditLog({
    actionType: AuditAction.MEMBER_APPROVED,
    performedByUserId: approvedByUserId,
    memberId,
    details: { previousStatus: "PENDING" },
  });

  return withClientPhotoUrl(member);
}

/**
 * Rejects a PENDING registration by deleting the member + user (and photo).
 * Frees email/phone so the person can self-register again.
 *
 * @param memberId - Pending member id
 * @param rejectedByUserId - Staff user rejecting
 */
export async function rejectMemberRegistration(
  memberId: string,
  rejectedByUserId: string
) {
  const existing = await prisma.member.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!existing) throw new Error("Member not found");
  if (existing.membershipStatus !== "PENDING") {
    throw new Error("Member is not awaiting verification");
  }

  // Audit before delete — memberId omitted so the FK does not block removal.
  await writeAuditLog({
    actionType: AuditAction.MEMBER_REJECTED,
    performedByUserId: rejectedByUserId,
    details: {
      previousStatus: "PENDING",
      deleted: true,
      memberId: existing.id,
      fullName: existing.fullName,
      phone: existing.phone,
      email: existing.user.email,
    },
  });

  await deleteMemberPhotoIfStored(existing.photoUrl);

  // Member first (registeredBy may point at the same user), then the User row.
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.member.delete({ where: { id: memberId } });
    await tx.user.delete({ where: { id: existing.userId } });
  });

  return { deleted: true as const, memberId };
}

/**
 * Lists members with a self-service photo retake awaiting staff review
 * (`pendingPhotoUrl` is set).
 */
export async function listPendingPhotoRetakes() {
  const members = await prisma.member.findMany({
    where: { pendingPhotoUrl: { not: null } },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, email: true } },
    },
  });
  return members.map((m) => withClientPhotoUrl(m));
}

/**
 * Approves a pending photo retake: pending becomes live; previous live file deleted.
 */
export async function approvePendingPhoto(
  memberId: string,
  approvedByUserId: string
) {
  const existing = await prisma.member.findUnique({ where: { id: memberId } });
  if (!existing) throw new Error("Member not found");
  if (!existing.pendingPhotoUrl) {
    throw new Error("No pending photo retake for this member");
  }

  const previousLive = existing.photoUrl;
  const pending = existing.pendingPhotoUrl;

  const member = await prisma.member.update({
    where: { id: memberId },
    data: {
      photoUrl: pending,
      pendingPhotoUrl: null,
    },
  });

  await deleteMemberPhotoIfStored(previousLive);

  await writeAuditLog({
    actionType: AuditAction.MEMBER_PHOTO_APPROVED,
    performedByUserId: approvedByUserId,
    memberId,
    details: { previousPhotoUrl: previousLive, photoUrl: pending },
  });

  return withClientPhotoUrl(member);
}

/**
 * Rejects a pending photo retake: deletes pending file; live photo unchanged.
 */
export async function rejectPendingPhoto(
  memberId: string,
  rejectedByUserId: string
) {
  const existing = await prisma.member.findUnique({ where: { id: memberId } });
  if (!existing) throw new Error("Member not found");
  if (!existing.pendingPhotoUrl) {
    throw new Error("No pending photo retake for this member");
  }

  const pending = existing.pendingPhotoUrl;
  const member = await prisma.member.update({
    where: { id: memberId },
    data: { pendingPhotoUrl: null },
  });

  await deleteMemberPhotoIfStored(pending);

  await writeAuditLog({
    actionType: AuditAction.MEMBER_PHOTO_REJECTED,
    performedByUserId: rejectedByUserId,
    memberId,
    details: {
      rejectedPhotoUrl: pending,
      keptPhotoUrl: existing.photoUrl,
    },
  });

  return withClientPhotoUrl(member);
}

type UpdateInput = z.infer<typeof updateMemberSchema>;

/**
 * Updates member contact fields (and status when `asAdmin`).
 *
 * @param memberId - Target member
 * @param input - Partial update fields
 * @param performedByUserId - Actor user id for audit
 * @param asAdmin - Whether membershipStatus may be changed
 */
export async function updateMember(
  memberId: string,
  input: UpdateInput,
  performedByUserId: string,
  asAdmin: boolean
) {
  if (!asAdmin) {
    const rest = { ...input };
    delete rest.membershipStatus;
    input = rest;
  }

  const member = await prisma.member.update({
    where: { id: memberId },
    data: {
      phone: input.phone,
      email: input.email === "" ? null : input.email,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      membershipStatus: asAdmin ? input.membershipStatus : undefined,
    },
  });

  await writeAuditLog({
    actionType: AuditAction.MEMBER_UPDATED,
    performedByUserId,
    memberId,
    details: input,
  });

  return withClientPhotoUrl(member);
}
