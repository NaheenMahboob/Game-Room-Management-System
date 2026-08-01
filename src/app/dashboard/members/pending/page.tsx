"use client";

/**
 * Volunteer/admin queue to approve self-registered members after reviewing photos.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type PendingMember = {
  id: string;
  fullName: string;
  phone: string;
  photoUrl: string;
  createdAt: string;
  user: { email: string };
};

export default function PendingMembersPage() {
  const toast = useToast();
  const [members, setMembers] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const data = await apiFetch<{ members: PendingMember[] }>(
      "/api/members/pending"
    );
    setMembers(data.members);
  }, []);

  useEffect(() => {
    refresh().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
  }, [refresh, toast]);

  async function act(memberId: string, action: "approve" | "reject") {
    setLoading(true);
    try {
      await apiFetch("/api/members/pending", {
        method: "PATCH",
        body: JSON.stringify({ memberId, action }),
      });
      toast.push(action === "approve" ? "Member approved" : "Registration rejected");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Pending photo verification</h1>
        <Link
          href="/dashboard/members"
          className="min-h-11 rounded-xl bg-slate-700 px-4 py-2 font-semibold"
        >
          Back to members
        </Link>
      </div>
      <p className="text-sm text-slate-400">
        Self-registered members appear here until you confirm their photo matches
        the person (or reject the request).
      </p>

      {members.length === 0 ? (
        <p className="text-slate-400">No pending registrations.</p>
      ) : (
        <ul className="space-y-4">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap gap-5 rounded-2xl border border-slate-700 bg-slate-900/70 p-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.photoUrl}
                alt=""
                className="h-36 w-36 rounded-2xl object-cover bg-slate-800"
              />
              <div className="flex-1 space-y-2">
                <h2 className="text-xl font-bold">{m.fullName}</h2>
                <p className="text-slate-300">{m.user.email}</p>
                <p className="text-sm text-slate-400">{m.phone}</p>
                <p className="text-xs text-slate-500">
                  Submitted {new Date(m.createdAt).toLocaleString()}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => act(m.id, "approve")}
                    className="min-h-11 rounded-xl bg-emerald-600 px-4 font-semibold disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => act(m.id, "reject")}
                    className="min-h-11 rounded-xl bg-red-600 px-4 font-semibold disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
