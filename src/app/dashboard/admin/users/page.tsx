"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type User = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  member: { id: string; fullName: string } | null;
};

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"VOLUNTEER" | "ADMIN">("VOLUNTEER");

  async function refresh() {
    const data = await apiFetch<{ users: User[] }>("/api/admin/users");
    setUsers(data.users);
  }

  useEffect(() => {
    refresh().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
  }, [toast]);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    try {
      const data = await apiFetch<{
        user: User;
        temporaryPassword: string;
      }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      toast.push(
        `Created ${data.user.email}. Temp password: ${data.temporaryPassword}`
      );
      setEmail("");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function updateUser(
    id: string,
    body: Record<string, unknown>
  ) {
    try {
      const data = await apiFetch<{
        user: User;
        temporaryPassword?: string;
      }>(`/api/admin/users?id=${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (data.temporaryPassword) {
        toast.push(`New password: ${data.temporaryPassword}`);
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

      <form
        onSubmit={createUser}
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 p-4"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="volunteer@mosque.local"
          className="min-h-11 min-w-[220px] flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "VOLUNTEER" | "ADMIN")}
          className="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-3"
        >
          <option value="VOLUNTEER">VOLUNTEER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-amber-500 px-4 font-semibold text-slate-950"
        >
          Create user
        </button>
      </form>

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
                {user.member ? ` · member ${user.member.fullName}` : ""}
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
