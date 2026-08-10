/**
 * Guest pass issuance and guest sign-in/out against host limits.
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { getGuestLimit } from "@/lib/settings";
import { flagMinorRegistrationAgeExpired } from "@/lib/services/members";

/**
 * Creates a guest pass for an active host member, enforcing per-host open-pass limits.
 *
 * @param hostMemberId - Member sponsoring the guest
 * @param guestName - Guest display name
 * @param guestPhone - Guest contact phone
 * @param performedByUserId - Staff user issuing the pass
 */
export async function issueGuestPass(
  hostMemberId: string,
  guestName: string,
  guestPhone: string,
  performedByUserId: string
) {
  const host = await prisma.member.findUnique({ where: { id: hostMemberId } });
  if (!host) throw new Error("Host member not found");
  if (await flagMinorRegistrationAgeExpired(hostMemberId)) {
    throw new Error(
      "This minor registration has expired (member is now 18+). Delete the account so they can re-register as an adult."
    );
  }
  if (host.membershipStatus !== "ACTIVE") {
    throw new Error("Host membership is inactive");
  }

  const limit = await getGuestLimit();
  const openPasses = await prisma.guestPass.count({
    where: {
      hostMemberId,
      signedOutAt: null,
    },
  });

  if (openPasses >= limit) {
    throw new Error(
      `Host already has ${openPasses} open guest pass(es); limit is ${limit}`
    );
  }

  const pass = await prisma.$transaction(async (tx) => {
    const created = await tx.guestPass.create({
      data: {
        hostMemberId,
        guestName,
        guestPhone,
      },
      include: {
        hostMember: { select: { id: true, fullName: true } },
      },
    });

    await writeAuditLog(
      {
        actionType: AuditAction.GUEST_PASS_ISSUED,
        performedByUserId,
        memberId: hostMemberId,
        details: {
          guestPassId: created.id,
          guestName,
          guestPhone,
          label: `Guest of ${host.fullName}`,
        },
      },
      tx
    );

    return created;
  });

  return {
    ...pass,
    displayName: `Guest of ${host.fullName}`,
  };
}

/**
 * Records guest arrival on an issued pass that is not already signed in.
 *
 * @param guestPassId - Guest pass to activate
 * @param performedByUserId - Staff user performing sign-in
 */
export async function signInGuest(
  guestPassId: string,
  performedByUserId: string
) {
  const pass = await prisma.guestPass.findUnique({
    where: { id: guestPassId },
    include: { hostMember: true },
  });
  if (!pass) throw new Error("Guest pass not found");
  if (pass.signedOutAt) throw new Error("Guest pass already closed");
  if (pass.signedInAt && !pass.signedOutAt) {
    throw new Error("Guest is already signed in");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.guestPass.update({
      where: { id: guestPassId },
      data: { signedInAt: new Date() },
      include: { hostMember: { select: { id: true, fullName: true } } },
    });

    await writeAuditLog(
      {
        actionType: AuditAction.GUEST_SIGNED_IN,
        performedByUserId,
        memberId: pass.hostMemberId,
        details: { guestPassId, guestName: pass.guestName },
      },
      tx
    );

    return row;
  });

  return {
    ...updated,
    displayName: `Guest of ${updated.hostMember.fullName}`,
  };
}

/**
 * Closes an active guest visit and marks the pass signed out.
 *
 * @param guestPassId - Guest pass to close
 * @param performedByUserId - Staff user performing sign-out
 */
export async function signOutGuest(
  guestPassId: string,
  performedByUserId: string
) {
  const pass = await prisma.guestPass.findUnique({
    where: { id: guestPassId },
  });
  if (!pass) throw new Error("Guest pass not found");
  if (!pass.signedInAt) throw new Error("Guest is not signed in");
  if (pass.signedOutAt) throw new Error("Guest already signed out");

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.guestPass.update({
      where: { id: guestPassId },
      data: { signedOutAt: new Date() },
      include: { hostMember: { select: { id: true, fullName: true } } },
    });

    await writeAuditLog(
      {
        actionType: AuditAction.GUEST_SIGNED_OUT,
        performedByUserId,
        memberId: pass.hostMemberId,
        details: { guestPassId, guestName: pass.guestName },
      },
      tx
    );

    return row;
  });

  return updated;
}
