/**
 * Canonical audit action type strings persisted on `AuditLog.actionType`.
 * Keep values stable — reports and filters depend on exact string matches.
 */
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
  /** Staff approved a PENDING self-registration after photo review. */
  MEMBER_APPROVED: "MEMBER_APPROVED",
  /** Staff rejected a PENDING self-registration. */
  MEMBER_REJECTED: "MEMBER_REJECTED",
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
