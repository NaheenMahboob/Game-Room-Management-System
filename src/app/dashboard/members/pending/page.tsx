"use client";

/**
 * Staff queues:
 * 1) New registrations awaiting admin verification of gov ID + waiver + photo
 * 2) Existing members' photo retakes (volunteers or admins)
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { ScrollPanel } from "@/components/ui/ScrollPanel";

type PendingMember = {
  id: string;
  fullName: string;
  phone: string;
  photoUrl: string;
  createdAt: string;
  user: { email: string };
  governmentIdUrl?: string | null;
  waiverPdfSrc?: string | null;
  hasWaiverPdf?: boolean;
};

type PhotoRetake = PendingMember & {
  pendingPhotoUrl: string | null;
};

/**
 * Pending verification queues for desk staff.
 *
 * @author Muhammad Naheen Mahboob
 */
export default function PendingMembersPage() {
  const toast = useToast();
  const [members, setMembers] = useState<PendingMember[]>([]);
  const [photoRetakes, setPhotoRetakes] = useState<PhotoRetake[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const refresh = useCallback(async () => {
    const data = await apiFetch<{
      members: PendingMember[];
      photoRetakes: PhotoRetake[];
    }>("/api/members/pending");
    setMembers(data.members);
    setPhotoRetakes(data.photoRetakes);
  }, []);

  useEffect(() => {
    apiFetch<{ user: { role: string } }>("/api/auth/me")
      .then((data) => setIsAdmin(data.user.role === "ADMIN"))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    refresh().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
  }, [refresh, toast]);

  async function actRegistration(
    memberId: string,
    action: "approve" | "reject"
  ) {
    if (action === "reject") {
      const confirmed = window.confirm(
        "Reject and delete this registration?\n\nThey can register again with the same email and phone. Press Cancel to leave them pending."
      );
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/members/pending", {
        method: "PATCH",
        body: JSON.stringify({ memberId, action }),
      });
      toast.push(
        action === "approve"
          ? "Member approved"
          : "Registration deleted — they can register again"
      );
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function actPhotoRetake(
    memberId: string,
    action: "approve" | "reject"
  ) {
    if (action === "reject") {
      const confirmed = window.confirm(
        "Reject this photo retake?\n\nThe member keeps their current photo. Press Cancel to leave the retake pending."
      );
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      await apiFetch(`/api/members/${memberId}/photo`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      toast.push(
        action === "approve"
          ? "New photo approved"
          : "Retake rejected — previous photo kept"
      );
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Pending verification</h1>
        <Link
          href="/dashboard/members"
          className="min-h-11 rounded-xl bg-slate-700 px-4 py-2 font-semibold"
        >
          Back to members
        </Link>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">New registrations</h2>
          <p className="text-sm text-slate-400">
            {isAdmin
              ? "Review the profile photo, government ID, and signed waiver, then approve or reject. Reject deletes the request so they can try again."
              : "Only admins can approve or reject registrations after checking the government ID and waiver. Volunteers can still handle photo retakes below."}
          </p>
        </div>

        {members.length === 0 ? (
          <p className="text-slate-400">No pending registrations.</p>
        ) : (
          <ScrollPanel label="Pending registrations">
            <ul className="space-y-4">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap gap-5 rounded-2xl border border-slate-700 bg-slate-900/70 p-4"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Profile
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.photoUrl}
                      alt=""
                      className="h-36 w-36 rounded-2xl object-cover bg-slate-800"
                    />
                  </div>
                  {isAdmin && m.governmentIdUrl ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase text-amber-400">
                        Government ID
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.governmentIdUrl}
                        alt=""
                        className="h-36 w-56 rounded-2xl object-cover bg-slate-800 ring-2 ring-amber-500/50"
                      />
                    </div>
                  ) : null}
                  <div className="flex-1 space-y-2">
                    <h3 className="text-xl font-bold">{m.fullName}</h3>
                    <p className="text-slate-300">{m.user.email}</p>
                    <p className="text-sm text-slate-400">{m.phone}</p>
                    <p className="text-xs text-slate-500">
                      Submitted {new Date(m.createdAt).toLocaleString()}
                    </p>
                    {isAdmin && m.waiverPdfSrc ? (
                      <a
                        href={m.waiverPdfSrc}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-sm font-semibold text-emerald-400 underline"
                      >
                        Open signed waiver PDF
                      </a>
                    ) : null}
                    {isAdmin ? (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => actRegistration(m.id, "approve")}
                          className="min-h-11 rounded-xl bg-emerald-600 px-4 font-semibold disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => actRegistration(m.id, "reject")}
                          className="min-h-11 rounded-xl bg-red-600 px-4 font-semibold disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <p className="pt-2 text-sm text-amber-200">
                        Waiting for an admin to verify ID and waiver.
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollPanel>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Photo retakes</h2>
          <p className="text-sm text-slate-400">
            Members submitted a new photo from the portal. Approve to replace
            their live photo; reject to keep the previous one.
          </p>
        </div>

        {photoRetakes.length === 0 ? (
          <p className="text-slate-400">No pending photo retakes.</p>
        ) : (
          <ScrollPanel label="Pending photo retakes">
            <ul className="space-y-4">
              {photoRetakes.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap gap-5 rounded-2xl border border-slate-700 bg-slate-900/70 p-4"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Current
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.photoUrl}
                      alt=""
                      className="h-36 w-36 rounded-2xl object-cover bg-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase text-amber-400">
                      Proposed
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.pendingPhotoUrl ?? ""}
                      alt=""
                      className="h-36 w-36 rounded-2xl object-cover bg-slate-800 ring-2 ring-amber-500/60"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-xl font-bold">{m.fullName}</h3>
                    <p className="text-slate-300">{m.user.email}</p>
                    <p className="text-sm text-slate-400">{m.phone}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => actPhotoRetake(m.id, "approve")}
                        className="min-h-11 rounded-xl bg-emerald-600 px-4 font-semibold disabled:opacity-60"
                      >
                        Approve new photo
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => actPhotoRetake(m.id, "reject")}
                        className="min-h-11 rounded-xl bg-red-600 px-4 font-semibold disabled:opacity-60"
                      >
                        Reject — keep current
                      </button>
                      <Link
                        href={`/dashboard/members?memberId=${m.id}`}
                        className="inline-flex min-h-11 items-center rounded-xl bg-slate-700 px-4 font-semibold"
                      >
                        Open member
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollPanel>
        )}
      </section>
    </div>
  );
}
