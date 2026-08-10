/**
 * Member search, registration, profile updates, and pending approval workflows.
 * Covers desk/self registration, photo approval, QR lookup, and email domain checks.
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { generateQrPayload, generateTempPassword } from "@/lib/members/ids";
import { isMinor, isMinorRegistrationAgeExpired } from "@/lib/members/rules";
import { getCurrentWaiverVersion } from "@/lib/settings";
import {
  deleteMemberPhotoIfStored,
  withClientPhotoUrl,
} from "@/lib/uploads/memberPhoto";
import { deleteMemberWaiverIfStored } from "@/lib/uploads/memberWaiver";
import {
  deleteMemberGovernmentIdIfStored,
  memberGovernmentIdSrc,
} from "@/lib/uploads/memberGovernmentId";
import { createAndStoreSignedWaiverPdf } from "@/lib/waivers/signedPdf";
import type { z } from "zod";
import type {
  registerMemberSchema,
  selfRegisterMemberSchema,
  updateMemberSchema,
} from "@/lib/validation/schemas";
import { assertEmailDomainAcceptsMail } from "@/lib/validation/emailExists";

/**
 * Searches members by name or phone and returns client-safe photo API URLs.
 *
 * Desk “let them in” search should use {@link searchWaitingForCheckIn} instead
 * so only people who requested check-in appear.
 *
 * @param q - Search query
 * @param limit - Max rows to return
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
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
      checkInRequestedAt: true,
      userId: true,
    },
  });
  return members.map(withClientPhotoUrl);
}

/**
 * Loads a member profile (open attendance + active loans) with a private photo URL.
 *
 * @param id - Member cuid
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
export async function getMemberById(id: string) {
  // Flip minor→adult registrations to AGE_EXPIRED before returning profile.
  await flagMinorRegistrationAgeExpired(id);
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
 * If this member registered under 18 and is now 18+, set status to AGE_EXPIRED.
 *
 * @param memberId - Member cuid
 * @returns true when the account is (or was just marked) age-expired
 * @author Muhammad Naheen Mahboob
 */
export async function flagMinorRegistrationAgeExpired(
  memberId: string
): Promise<boolean> {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return false;
  if (member.membershipStatus === "AGE_EXPIRED") return true;
  // Leave PENDING in the admin queue; approval sets AGE_EXPIRED when needed.
  if (member.membershipStatus === "PENDING") return false;
  if (
    !isMinorRegistrationAgeExpired(member.dateOfBirth, member.createdAt)
  ) {
    return false;
  }

  await prisma.member.update({
    where: { id: memberId },
    data: { membershipStatus: "AGE_EXPIRED" },
  });
  return true;
}

/**
 * Looks up a member by QR payload with a private photo URL for desk display.
 *
 * @param qrPayload - Scanned QR value
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
export async function getMemberByQr(qrPayload: string) {
  const found = await prisma.member.findUnique({
    where: { qrPayload },
    select: { id: true },
  });
  if (!found) return null;
  return getMemberById(found.id);
}

/** Validated desk registration payload from {@link registerMemberSchema}.
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
type RegisterInput = z.infer<typeof registerMemberSchema>;
/** Validated self-service registration payload from {@link selfRegisterMemberSchema}.
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
type SelfRegisterInput = z.infer<typeof selfRegisterMemberSchema>;

/** Ensures login email is not already registered before creating a member.
 * Phone may be shared (e.g. siblings with the same parent).
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
async function assertUniqueLoginEmail(email: string) {
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new Error("A user with this email already exists.");
  }
}

/**
 * Desk registration by volunteer/admin — PENDING until an admin verifies
 * the profile photo, government ID, and signed waiver PDF.
 *
 * @param input - Validated registration payload (photo + gov ID storage filenames)
 * @param registeredByUserId - Staff user performing registration
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
export async function registerMember(
  input: RegisterInput,
  registeredByUserId: string
) {
  const waiverVersion = await getCurrentWaiverVersion();
  // Optional at the desk: blank → synthetic mosque.local login email (no MX).
  const providedEmail =
    input.email && input.email.length > 0
      ? input.email.toLowerCase()
      : null;
  const email = providedEmail ?? `member+${Date.now()}@mosque.local`;

  const dob = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  if (dob && isMinor(dob) && !input.parentalConsent) {
    throw new Error(
      "Parental consent is required for members under 18 before registration can complete."
    );
  }

  await assertUniqueLoginEmail(email);
  // Reject disposable / non-mail domains when staff enter a real address.
  if (providedEmail) {
    await assertEmailDomainAcceptsMail(providedEmail);
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  // Unique QR payload for the membership card / desk scanner.
  const qrPayload = generateQrPayload();

  const parentalConsent =
    dob && isMinor(dob) ? input.parentalConsent : true;
  const signedAt = new Date();
  // Stamp signature onto the current waiver PDF before the DB row exists.
  const signedWaiver = await createAndStoreSignedWaiverPdf({
    fullName: input.fullName,
    phone: input.phone,
    email: providedEmail,
    dateOfBirth: dob,
    parentalConsent,
    signature: input.waiverSignature,
    waiverVersion,
    signedAt,
  });

  try {
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

        // PENDING until an admin reviews gov ID + waiver (not auto-approved).
        const member = await tx.member.create({
          data: {
            userId: user.id,
            fullName: input.fullName,
            phone: input.phone,
            email: input.email && input.email.length > 0 ? input.email : null,
            emergencyContactName: input.emergencyContactName,
            emergencyContactPhone: input.emergencyContactPhone,
            photoUrl: input.photoUrl,
            governmentIdUrl: input.governmentIdUrl,
            membershipStatus: "PENDING",
            dateOfBirth: dob,
            waiverSigned: true,
            waiverSignedAt: signedAt,
            waiverVersion: signedWaiver.version,
            waiverPdfUrl: signedWaiver.filename,
            waiverPdfSha256: signedWaiver.sha256,
            parentalConsent,
            qrPayload,
            registeredByUserId,
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
              waiverVersion: signedWaiver.version,
              waiverPdfUrl: signedWaiver.filename,
              waiverPdfSha256: signedWaiver.sha256,
              governmentIdUrl: input.governmentIdUrl,
              source: "desk",
              pendingAdminVerification: true,
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
  } catch (error) {
    await deleteMemberWaiverIfStored(signedWaiver.filename);
    await deleteMemberGovernmentIdIfStored(input.governmentIdUrl);
    throw error;
  }
}

/**
 * Member self-registration — PENDING until an admin verifies government ID,
 * waiver PDF, and profile photo.
 *
 * @param input - Form fields including password, photo, and gov ID filenames
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
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

  await assertUniqueLoginEmail(email);
  // Self-register always has a real email — MX + disposable checks required.
  await assertEmailDomainAcceptsMail(email);

  const passwordHash = await hashPassword(input.password);
  const qrPayload = generateQrPayload();

  const parentalConsent =
    dob && isMinor(dob) ? input.parentalConsent : true;
  const signedAt = new Date();
  const signedWaiver = await createAndStoreSignedWaiverPdf({
    fullName: input.fullName,
    phone: input.phone,
    email,
    dateOfBirth: dob,
    parentalConsent,
    signature: input.waiverSignature,
    waiverVersion,
    signedAt,
  });

  try {
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
            governmentIdUrl: input.governmentIdUrl,
            membershipStatus: "PENDING",
            dateOfBirth: dob,
            waiverSigned: true,
            waiverSignedAt: signedAt,
            waiverVersion: signedWaiver.version,
            waiverPdfUrl: signedWaiver.filename,
            waiverPdfSha256: signedWaiver.sha256,
            parentalConsent,
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
              waiverVersion: signedWaiver.version,
              waiverPdfUrl: signedWaiver.filename,
              waiverPdfSha256: signedWaiver.sha256,
              governmentIdUrl: input.governmentIdUrl,
              source: "self",
              pendingAdminVerification: true,
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
  } catch (error) {
    await deleteMemberWaiverIfStored(signedWaiver.filename);
    await deleteMemberGovernmentIdIfStored(input.governmentIdUrl);
    throw error;
  }
}

/**
 * Lists members awaiting admin verification of gov ID + waiver + profile photo.
 * Includes client URLs for admin review (gov ID + waiver PDF).
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
export async function listPendingMembers() {
  const members = await prisma.member.findMany({
    where: { membershipStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, email: true } },
    },
  });
  return members.map((m) => {
    const withPhoto = withClientPhotoUrl(m);
    return {
      ...withPhoto,
      // Admin-only GET routes; volunteers will receive 403 if they open these.
      governmentIdUrl: m.governmentIdUrl
        ? memberGovernmentIdSrc(m.id)
        : null,
      hasWaiverPdf: Boolean(m.waiverPdfUrl),
      waiverPdfSrc: m.waiverPdfUrl
        ? `/api/members/${m.id}/waiver`
        : null,
    };
  });
}

/**
 * Approves a PENDING registration after an admin reviews gov ID + waiver PDF.
 *
 * @param memberId - Pending member id
 * @param approvedByUserId - Admin performing approval
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
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

  // Registered as a minor but already 18 by approval day → cannot activate.
  const ageExpired = isMinorRegistrationAgeExpired(
    existing.dateOfBirth,
    existing.createdAt
  );
  const membershipStatus = ageExpired ? "AGE_EXPIRED" : "ACTIVE";

  const member = await prisma.member.update({
    where: { id: memberId },
    data: {
      membershipStatus,
      approvedByUserId,
      approvedAt: new Date(),
    },
  });

  await writeAuditLog({
    actionType: AuditAction.MEMBER_APPROVED,
    performedByUserId: approvedByUserId,
    memberId,
    details: {
      previousStatus: "PENDING",
      membershipStatus,
      ageExpired,
    },
  });

  return withClientPhotoUrl(member);
}

/**
 * Rejects a PENDING registration by deleting the member + user and stored
 * artifacts (profile photo, government ID, waiver PDF). Frees email/phone.
 *
 * @param memberId - Pending member id
 * @param rejectedByUserId - Admin rejecting
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
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
  await deleteMemberGovernmentIdIfStored(existing.governmentIdUrl);
  await deleteMemberWaiverIfStored(existing.waiverPdfUrl);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await detachUserAndMemberForDelete(
      tx,
      existing.id,
      existing.userId,
      rejectedByUserId
    );
  });

  return { deleted: true as const, memberId };
}

/**
 * Hard-deletes any member account (ACTIVE/PENDING/INACTIVE) and stored files.
 * Admin-only path so fake or mistaken accounts can be remade with the same email.
 *
 * @param memberId - Member to erase
 * @param deletedByUserId - Admin performing the delete
 * @author Muhammad Naheen Mahboob
 */
export async function deleteMemberHard(
  memberId: string,
  deletedByUserId: string
) {
  const existing = await prisma.member.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, email: true, role: true } } },
  });
  if (!existing) throw new Error("Member not found");
  if (existing.user.role !== "MEMBER") {
    throw new Error(
      "Only member accounts can be deleted here. Change staff roles from Admin → Users."
    );
  }
  if (existing.userId === deletedByUserId) {
    throw new Error("You cannot delete your own account");
  }

  await writeAuditLog({
    actionType: AuditAction.MEMBER_DELETED,
    performedByUserId: deletedByUserId,
    details: {
      deleted: true,
      memberId: existing.id,
      fullName: existing.fullName,
      phone: existing.phone,
      email: existing.user.email,
      membershipStatus: existing.membershipStatus,
    },
  });

  await deleteMemberPhotoIfStored(existing.photoUrl);
  await deleteMemberPhotoIfStored(existing.pendingPhotoUrl);
  await deleteMemberGovernmentIdIfStored(existing.governmentIdUrl);
  await deleteMemberWaiverIfStored(existing.waiverPdfUrl);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await detachUserAndMemberForDelete(
      tx,
      existing.id,
      existing.userId,
      deletedByUserId
    );
  });

  return { deleted: true as const, memberId };
}

/**
 * Reassigns history FKs that block User/Member deletion, then deletes both rows.
 * Attendance / loans / audit rows that reference this user as staff are pointed
 * at the admin performing the delete so room history is preserved.
 *
 * @param tx - Open Prisma transaction
 * @param memberId - Member row to remove
 * @param userId - Linked user row to remove
 * @param reassignToUserId - Admin (or other surviving user) to own orphaned FKs
 * @author Muhammad Naheen Mahboob
 */
async function detachUserAndMemberForDelete(
  tx: Prisma.TransactionClient,
  memberId: string,
  userId: string,
  reassignToUserId: string
) {
  // Drop member link on audit rows so Member delete is not blocked.
  await tx.auditLog.updateMany({
    where: { memberId },
    data: { memberId: null },
  });

  // Preserve audit history: move "performed by" off the user being deleted.
  await tx.auditLog.updateMany({
    where: { performedByUserId: userId },
    data: { performedByUserId: reassignToUserId },
  });

  await tx.attendance.updateMany({
    where: { signedInByUserId: userId },
    data: { signedInByUserId: reassignToUserId },
  });
  await tx.attendance.updateMany({
    where: { signedOutByUserId: userId },
    data: { signedOutByUserId: reassignToUserId },
  });

  await tx.loan.updateMany({
    where: { borrowedByUserId: userId },
    data: { borrowedByUserId: reassignToUserId },
  });
  await tx.loan.updateMany({
    where: { returnedByUserId: userId },
    data: { returnedByUserId: reassignToUserId },
  });

  // Other members may still list this user as registrar / approver.
  await tx.member.updateMany({
    where: { registeredByUserId: userId, NOT: { id: memberId } },
    data: { registeredByUserId: reassignToUserId },
  });
  await tx.member.updateMany({
    where: { approvedByUserId: userId },
    data: { approvedByUserId: reassignToUserId },
  });

  await tx.announcement.updateMany({
    where: { createdByUserId: userId },
    data: { createdByUserId: reassignToUserId },
  });
  await tx.event.updateMany({
    where: { createdByUserId: userId },
    data: { createdByUserId: reassignToUserId },
  });
  await tx.waiver.updateMany({
    where: { createdByUserId: userId },
    data: { createdByUserId: reassignToUserId },
  });

  await tx.shiftChecklist.updateMany({
    where: { volunteerUserId: userId },
    data: { volunteerUserId: reassignToUserId },
  });

  // Self-registered members point registeredBy at themselves — retarget first.
  await tx.member.update({
    where: { id: memberId },
    data: {
      registeredByUserId: reassignToUserId,
      approvedByUserId: null,
    },
  });

  await tx.member.delete({ where: { id: memberId } });
  await tx.user.delete({ where: { id: userId } });
}

/**
 * Lists members with a self-service photo retake awaiting staff review
 * (`pendingPhotoUrl` is set).
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
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
 *
 * @param memberId - Member with `pendingPhotoUrl` set
 * @param approvedByUserId - Staff user approving the retake
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
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
 *
 * @param memberId - Member with `pendingPhotoUrl` set
 * @param rejectedByUserId - Staff user rejecting the retake
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
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

/** Validated member profile update payload from {@link updateMemberSchema}.
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
type UpdateInput = z.infer<typeof updateMemberSchema>;

/**
 * Updates member contact fields (and status when `asAdmin`).
 *
 * @param memberId - Target member
 * @param input - Partial update fields
 * @param performedByUserId - Actor user id for audit
 * @param asAdmin - Whether membershipStatus may be changed
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
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

  if (input.email && input.email.length > 0) {
    // Same domain checks as registration so profile edits cannot store fake mail.
    await assertEmailDomainAcceptsMail(input.email.toLowerCase());
  }

  if (asAdmin && input.membershipStatus === "ACTIVE") {
    const existing = await prisma.member.findUnique({
      where: { id: memberId },
    });
    if (
      existing &&
      (existing.membershipStatus === "AGE_EXPIRED" ||
        isMinorRegistrationAgeExpired(existing.dateOfBirth, existing.createdAt))
    ) {
      throw new Error(
        "This minor registration has expired. Delete the account so they can re-register as an adult."
      );
    }
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
