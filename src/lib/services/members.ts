import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { generateQrPayload, generateTempPassword } from "@/lib/members/ids";
import { isMinor } from "@/lib/members/rules";
import { getCurrentWaiverVersion } from "@/lib/settings";
import { withClientPhotoUrl } from "@/lib/uploads/memberPhoto";
import type { z } from "zod";
import type {
  registerMemberSchema,
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

/**
 * Creates a member user account, stores the uploaded photo filename, and audits.
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

  const existingPhone = await prisma.member.findUnique({
    where: { phone: input.phone },
  });
  if (existingPhone) {
    throw new Error("A member with this phone number already exists.");
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new Error("A user with this email already exists.");
  }

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
          dateOfBirth: dob,
          waiverSigned: true,
          waiverSignedAt: new Date(),
          waiverVersion,
          parentalConsent: dob && isMinor(dob) ? input.parentalConsent : true,
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
            waiverVersion,
            waiverSignature: input.waiverSignature,
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
