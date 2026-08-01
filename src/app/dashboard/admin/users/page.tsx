"use client";

/**
 * Admin users page: search existing accounts and change roles / reset passwords.
 * Does not create users from a bare email.
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type User = {
  id: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  createdAt: string;
  member: {
    id: string;
    fullName: string;
    membershipStatus: string;
  } | null;
};

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [tempCred, setTempCred] = useState<{
    email: string;
    password: string;
  } | null>(null);

  async function refresh(search = q) {
    const query = search.trim()
      ? `?q=${encodeURIComponent(search.trim())}`
      : "";
    const data = await apiFetch<{ users: User[] }>(`/api/admin/users${query}`);
    setUsers(data.users);
  }

  useEffect(() => {
    refresh("").catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  async function updateUser(id: string, body: Record<string, unknown>) {
    try {
      const data = await apiFetch<{
        user: User;
        temporaryPassword?: string;
      }>(`/api/admin/users?id=${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (data.temporaryPassword) {
        setTempCred({
          email: data.user.email,
          password: data.temporaryPassword,
        });
        toast.push("Password reset — copy the temporary password below");
      } else {
        toast.push("User updated");
      }
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Users</h2>
      <p className="text-sm text-slate-400">
        Search for an existing account, then change its role or reset its
        password. New members register via the portal or volunteer desk — you
        cannot invent accounts from an email alone.
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
            password (works for members, volunteers, and admins).
          </p>
          <p className="mt-3 font-mono text-sm">
            {tempCred.email}
            <br />
            {tempCred.password}
          </p>
          <button
            type="button"
            className="mt-3 min-h-10 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-slate-950"
            onClick={async () => {
              await navigator.clipboard.writeText(
                `Email: ${tempCred.email}\nTemp password: ${tempCred.password}`
              );
              toast.push("Copied");
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className="ml-2 min-h-10 rounded-xl bg-slate-700 px-4 text-sm font-semibold"
            onClick={() => setTempCred(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <ul className="space-y-2">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3"
          >
            <div>
              <p className="font-semibold">{user.email}</p>
              <p className="text-sm text-slate-400">
                {user.role}
                {user.member
                  ? ` · ${user.member.fullName} (${user.member.membershipStatus})`
                  : ""}
                {user.mustChangePassword ? " · must change password" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={user.role}
                onChange={(e) => updateUser(user.id, { role: e.target.value })}
                className="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-2 text-sm"
              >
                <option value="MEMBER">MEMBER</option>
                <option value="VOLUNTEER">VOLUNTEER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <button
                type="button"
                onClick={() => updateUser(user.id, { resetPassword: true })}
                className="min-h-11 rounded-xl bg-slate-700 px-3 text-sm font-semibold"
              >
                Reset password
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
