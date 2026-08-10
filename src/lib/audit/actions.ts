/**
 * Canonical audit action type strings persisted on `AuditLog.actionType`.
 * Keep values stable — reports and filters depend on exact string matches.
 */
/** Stable string constants for `AuditLog.actionType` (see module doc). */
export const AuditAction = {
  MEMBER_REGISTERED: "MEMBER_REGISTERED",
  MEMBER_UPDATED: "MEMBER_UPDATED",
  /** Staff or desk replaced the live profile photo immediately. */
  MEMBER_PHOTO_UPDATED: "MEMBER_PHOTO_UPDATED",
  /** Member submitted a retake; awaiting staff approve/reject. */
  MEMBER_PHOTO_PENDING: "MEMBER_PHOTO_PENDING",
  /** Staff approved a pending photo retake (old file removed). */
  MEMBER_PHOTO_APPROVED: "MEMBER_PHOTO_APPROVED",
  /** Staff rejected a pending photo retake (pending file removed; live photo kept). */
  MEMBER_PHOTO_REJECTED: "MEMBER_PHOTO_REJECTED",
  /** Admin approved a PENDING registration after gov ID + waiver review. */
  MEMBER_APPROVED: "MEMBER_APPROVED",
  /** Admin rejected a PENDING registration (account deleted). */
  MEMBER_REJECTED: "MEMBER_REJECTED",
  /** Admin hard-deleted a member account and stored artifacts. */
  MEMBER_DELETED: "MEMBER_DELETED",
  /** Member (or desk register) requested room entry — waiting for staff sign-in. */
  CHECK_IN_REQUESTED: "CHECK_IN_REQUESTED",
  /** Member cancelled their waiting check-in request. */
  CHECK_IN_CANCELLED: "CHECK_IN_CANCELLED",
  SIGN_IN: "SIGN_IN",
  SIGN_OUT: "SIGN_OUT",
  FORCE_SIGN_OUT: "FORCE_SIGN_OUT",
  EQUIPMENT_BORROWED: "EQUIPMENT_BORROWED",
  EQUIPMENT_RETURNED: "EQUIPMENT_RETURNED",
  EQUIPMENT_CONDITION_UPDATED: "EQUIPMENT_CONDITION_UPDATED",
  QUEUE_JOINED: "QUEUE_JOINED",
  QUEUE_REMOVED: "QUEUE_REMOVED",
  GUEST_PASS_ISSUED: "GUEST_PASS_ISSUED",
  GUEST_SIGNED_IN: "GUEST_SIGNED_IN",
  GUEST_SIGNED_OUT: "GUEST_SIGNED_OUT",
  WAIVER_SIGNED: "WAIVER_SIGNED",
} as const;

/** Union of all known {@link AuditAction} string values. */
export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];
