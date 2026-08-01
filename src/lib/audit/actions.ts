/**
 * Canonical audit action type strings persisted on `AuditLog.actionType`.
 * Keep values stable — reports and filters depend on exact string matches.
 */
export const AuditAction = {
  MEMBER_REGISTERED: "MEMBER_REGISTERED",
  MEMBER_UPDATED: "MEMBER_UPDATED",
  /** Staff or self replaced a member profile photo on disk. */
  MEMBER_PHOTO_UPDATED: "MEMBER_PHOTO_UPDATED",
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
