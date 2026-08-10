"use client";

/**
 * Admin users page: search existing accounts and change roles / reset passwords.
 * Does not create users from a bare email.
 * Password-reset temp credentials stay on screen until Copy succeeds, then Dismiss.
 * Only the bootstrap admin may change another ADMIN's role.
 * User results render inside a scroll panel; selecting a row expands member
 * document links (signed waiver PDF + government ID) and delete (MEMBER only).
 * Role promote/demote and delete use an in-app Yes/No confirmation dialog.
 *
 * @author Muhammad Naheen Mahboob
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { ScrollPanel } from "@/components/ui/ScrollPanel";

/**
 * User row from `GET /api/admin/users`.
 *
 * @author Muhammad Naheen Mahboob
 */
type User = {
  id: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  createdAt: string;
  /** True for the ADMIN_EMAIL / seed bootstrap account — role cannot be demoted. */
  isBootstrap?: boolean;
  member: {
    id: string;
    fullName: string;
    membershipStatus: string;
    hasWaiverPdf?: boolean;
    hasGovernmentId?: boolean;
    waiverPdfSrc?: string | null;
    governmentIdSrc?: string | null;
  } | null;
};

/** Pending Yes/No confirmation for promote, demote, or delete. */
type PendingConfirm =
  | {
      kind: "role";
      userId: string;
      email: string;
      fromRole: string;
      toRole: string;
      actionLabel: "promote" | "demote";
    }
  | {
      kind: "delete";
      userId: string;
      memberId: string;
      email: string;
      fullName: string;
    };

/**
 * Admin UI for role changes, password resets, and member document lookup.
 *
 * @author Muhammad Naheen Mahboob
 */
export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [selfId, setSelfId] = useState<string | null>(null);
  // From /me or users GET — gates editing other ADMIN role selects.
  const [viewerIsBootstrap, setViewerIsBootstrap] = useState(false);
  /** Selected user id — expands the card with waiver / gov ID links. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tempCred, setTempCred] = useState<{
    email: string;
    password: string;
  } | null>(null);
  /** Dismiss stays disabled until the admin copies the temp password. */
  const [tempCredCopied, setTempCredCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null
  );
  const [confirmBusy, setConfirmBusy] = useState(false);

  /**
   * Loads / searches the user list and refreshes bootstrap viewer flag.
   *
   * @author Muhammad Naheen Mahboob
   */
  async function refresh(search = q) {
    const query = search.trim()
      ? `?q=${encodeURIComponent(search.trim())}`
      : "";
    const data = await apiFetch<{
      users: User[];
      viewerIsBootstrap?: boolean;
    }>(`/api/admin/users${query}`);
    setUsers(data.users);
    if (typeof data.viewerIsBootstrap === "boolean") {
      setViewerIsBootstrap(data.viewerIsBootstrap);
    }
  }

  useEffect(() => {
    apiFetch<{ user: { id: string; isBootstrap?: boolean } }>("/api/auth/me")
      .then((d) => {
        setSelfId(d.user.id);
        if (typeof d.user.isBootstrap === "boolean") {
          setViewerIsBootstrap(d.user.isBootstrap);
        }
      })
      .catch(() => undefined);
    refresh("").catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  /**
   * Rough rank for promote vs demote wording in confirm dialogs.
   *
   * @author Muhammad Naheen Mahboob
   */
  function roleRank(role: string): number {
    if (role === "ADMIN") return 3;
    if (role === "VOLUNTEER") return 2;
    return 1;
  }

  /**
   * Opens the Yes/No dialog when the role select changes.
   *
   * @author Muhammad Naheen Mahboob
   */
  function requestRoleChange(user: User, nextRole: string) {
    if (user.role === nextRole) return;
    setPendingConfirm({
      kind: "role",
      userId: user.id,
      email: user.email,
      fromRole: user.role,
      toRole: nextRole,
      actionLabel:
        roleRank(nextRole) > roleRank(user.role) ? "promote" : "demote",
    });
  }

  /**
   * Opens the Yes/No dialog for hard-deleting a MEMBER account.
   *
   * @author Muhammad Naheen Mahboob
   */
  function requestDeleteMember(user: User) {
    if (!user.member) {
      toast.push("This account has no member profile to delete", "error");
      return;
    }
    if (user.role !== "MEMBER") {
      toast.push(
        "Demote to MEMBER first, then delete. Staff accounts are not deleted here.",
        "warn"
      );
      return;
    }
    if (user.id === selfId) {
      toast.push("You cannot delete your own account", "error");
      return;
    }
    setPendingConfirm({
      kind: "delete",
      userId: user.id,
      memberId: user.member.id,
      email: user.email,
      fullName: user.member.fullName,
    });
  }

  /**
   * Runs the confirmed promote/demote or delete action.
   *
   * @author Muhammad Naheen Mahboob
   */
  async function confirmPendingYes() {
    if (!pendingConfirm) return;
    setConfirmBusy(true);
    try {
      if (pendingConfirm.kind === "role") {
        const data = await apiFetch<{ user: User }>(
          `/api/admin/users?id=${pendingConfirm.userId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ role: pendingConfirm.toRole }),
          }
        );
        toast.push(
          `User ${pendingConfirm.actionLabel}d to ${data.user.role}`
        );
        setPendingConfirm(null);
        await refresh();
        return;
      }

      setDeletingId(pendingConfirm.userId);
      await apiFetch(`/api/members/${pendingConfirm.memberId}`, {
        method: "DELETE",
      });
      toast.push("Member deleted");
      if (selectedId === pendingConfirm.userId) setSelectedId(null);
      setPendingConfirm(null);
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setDeletingId(null);
      setConfirmBusy(false);
    }
  }

  /**
   * PATCHes password reset; shows temp credentials when reset.
   *
   * @author Muhammad Naheen Mahboob
   */
  async function resetPassword(id: string) {
    try {
      const data = await apiFetch<{
        user: User;
        temporaryPassword?: string;
      }>(`/api/admin/users?id=${id}`, {
        method: "PATCH",
        body: JSON.stringify({ resetPassword: true }),
      });
      if (data.temporaryPassword) {
        setTempCred({
          email: data.user.email,
          password: data.temporaryPassword,
        });
        setTempCredCopied(false);
        toast.push("Password reset — copy the temporary password below");
      } else {
        toast.push("User updated");
      }
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  /**
   * Copies temp credentials; on clipboard failure, confirm to unlock Dismiss.
   *
   * @author Muhammad Naheen Mahboob
   */
  async function copyTempCred() {
    if (!tempCred) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${tempCred.email}\nTemp password: ${tempCred.password}`
      );
      setTempCredCopied(true);
      toast.push("Copied — you can dismiss when ready");
    } catch {
      const ok = window.confirm(
        "Clipboard copy failed. Have you written down or selected the temporary password?\n\nOK = yes, enable Dismiss. Cancel = stay on this panel."
      );
      if (ok) {
        setTempCredCopied(true);
        toast.push("Dismiss enabled — password will not be shown again", "warn");
      } else {
        toast.push(
          "Select the password text and copy it manually, then try Copy again",
          "error"
        );
      }
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Users</h2>
      <p className="text-sm text-slate-400">
        Search for an existing account, then change its role or reset its
        password. Click a row to open member documents (signed waiver and
        government ID) and delete a member account when needed. Role changes and
        deletes ask for confirmation. Promoted volunteers/admins keep their
        member profile and can still use the member portal. You cannot change
        your own role or demote the bootstrap admin. Only the bootstrap admin
        can change another admin&apos;s role; other admins may manage
        members/volunteers and promote to admin.
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && refresh()}
          placeholder="Search email or member name"
          className="min-h-11 min-w-[240px] flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3"
        />
        <button
          type="button"
          onClick={() => refresh()}
          className="min-h-11 rounded-xl bg-slate-700 px-4 font-semibold"
        >
          Search
        </button>
      </div>

      {tempCred ? (
        <div className="rounded-2xl border border-amber-500/50 bg-amber-950/30 p-4">
          <p className="font-semibold text-amber-200">Temporary password</p>
          <p className="mt-1 text-sm text-slate-300">
            Give this to the user. On their next sign-in they must set a new
            password. Copy it before dismissing — it will not be shown again.
          </p>
          <p className="mt-3 select-all font-mono text-sm">
            {tempCred.email}
            <br />
            {tempCred.password}
          </p>
          <button
            type="button"
            className="mt-3 min-h-10 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-slate-950"
            onClick={copyTempCred}
          >
            {tempCredCopied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            disabled={!tempCredCopied}
            title={
              tempCredCopied
                ? undefined
                : "Copy the temporary password before dismissing"
            }
            className="ml-2 min-h-10 rounded-xl bg-slate-700 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              setTempCred(null);
              setTempCredCopied(false);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <ScrollPanel label="Admin users list">
        <ul className="space-y-2">
          {users.map((user) => {
            const selected = selectedId === user.id;
            return (
              <li
                key={user.id}
                className={`rounded-xl border px-4 py-3 ${
                  selected
                    ? "border-emerald-500/50 bg-slate-900/80"
                    : "border-slate-700 bg-slate-900/50"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setSelectedId((id) => (id === user.id ? null : user.id))
                  }
                  className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
                >
                  <div>
                    <p className="font-semibold">{user.email}</p>
                    <p className="text-sm text-slate-400">
                      {user.role}
                      {user.member
                        ? ` · ${user.member.fullName} (${user.member.membershipStatus})`
                        : " · no member profile"}
                      {user.mustChangePassword ? " · must change password" : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selected
                        ? "Click again to collapse"
                        : "Click to view documents"}
                    </p>
                  </div>
                </button>

                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    value={user.role}
                    disabled={
                      user.id === selfId ||
                      Boolean(user.isBootstrap) ||
                      (user.role === "ADMIN" && !viewerIsBootstrap)
                    }
                    title={
                      user.id === selfId
                        ? "You cannot change your own role"
                        : user.isBootstrap
                          ? "Bootstrap admin cannot be demoted"
                          : user.role === "ADMIN" && !viewerIsBootstrap
                            ? "Only the bootstrap admin can change another admin's role"
                            : undefined
                    }
                    onChange={(e) => requestRoleChange(user, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-2 text-sm disabled:opacity-50"
                  >
                    <option value="MEMBER">MEMBER</option>
                    <option value="VOLUNTEER">VOLUNTEER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetPassword(user.id);
                    }}
                    className="min-h-11 rounded-xl bg-slate-700 px-3 text-sm font-semibold"
                  >
                    Reset password
                  </button>
                </div>

                {selected ? (
                  <div className="mt-4 space-y-2 rounded-xl border border-slate-600 bg-slate-950/60 p-3">
                    <p className="text-sm font-semibold text-slate-200">
                      Member documents
                    </p>
                    {!user.member ? (
                      <p className="text-sm text-slate-400">
                        This account has no linked member profile (no waiver or
                        government ID).
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {user.member.waiverPdfSrc ? (
                          <a
                            href={user.member.waiverPdfSrc}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold"
                          >
                            Open signed waiver PDF
                          </a>
                        ) : (
                          <span className="inline-flex min-h-11 items-center rounded-xl border border-slate-600 px-4 text-sm text-slate-500">
                            No waiver PDF on file
                          </span>
                        )}
                        {user.member.governmentIdSrc ? (
                          <a
                            href={user.member.governmentIdSrc}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center rounded-xl bg-amber-600 px-4 text-sm font-semibold text-slate-950"
                          >
                            Open government ID
                          </a>
                        ) : (
                          <span className="inline-flex min-h-11 items-center rounded-xl border border-slate-600 px-4 text-sm text-slate-500">
                            No government ID on file
                          </span>
                        )}
                        {user.role === "MEMBER" ? (
                          <button
                            type="button"
                            disabled={deletingId === user.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteMember(user);
                            }}
                            className="inline-flex min-h-11 items-center rounded-xl bg-red-700 px-4 text-sm font-semibold disabled:opacity-60"
                          >
                            {deletingId === user.id
                              ? "Deleting…"
                              : "Delete member"}
                          </button>
                        ) : (
                          <span className="inline-flex min-h-11 items-center rounded-xl border border-slate-600 px-4 text-sm text-slate-500">
                            Demote to MEMBER to delete
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </ScrollPanel>

      {pendingConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-xl">
            <h3 id="confirm-title" className="text-xl font-semibold">
              Are you sure?
            </h3>
            {pendingConfirm.kind === "role" ? (
              <p className="text-sm text-slate-300">
                {pendingConfirm.actionLabel === "promote" ? "Promote" : "Demote"}{" "}
                <span className="font-semibold text-white">
                  {pendingConfirm.email}
                </span>
                ?
                <br />
                <span className="font-mono text-slate-200">
                  {pendingConfirm.fromRole} → {pendingConfirm.toRole}
                </span>
              </p>
            ) : (
              <p className="text-sm text-slate-300">
                Permanently delete{" "}
                <span className="font-semibold text-white">
                  {pendingConfirm.fullName}
                </span>{" "}
                ({pendingConfirm.email})?
                <br />
                This removes their account, photos, government ID, and waiver
                PDF. The email and phone can be used again. This cannot be
                undone.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setPendingConfirm(null)}
                className="min-h-11 rounded-xl bg-slate-700 px-5 font-semibold disabled:opacity-60"
              >
                No
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => confirmPendingYes()}
                className={`min-h-11 rounded-xl px-5 font-semibold disabled:opacity-60 ${
                  pendingConfirm.kind === "delete"
                    ? "bg-red-600"
                    : "bg-emerald-600"
                }`}
              >
                {confirmBusy ? "Working…" : "Yes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
