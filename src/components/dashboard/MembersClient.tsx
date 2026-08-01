"use client";

/**
 * Volunteer desk member identify panel: search/QR, large photo for visual
 * verification, staff photo retake, and gated sign-in requiring photo match
 * confirmation.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { dashboardFetch } from "@/lib/offline/sync";
import { uploadMemberPhotoDataUrl } from "@/lib/uploads/client";
import { useToast } from "@/components/ui/Toast";
import { QrScannerModal } from "@/components/dashboard/QrScannerModal";
import { GuestPassForm } from "@/components/dashboard/GuestPassForm";
import { PhotoCapture } from "@/components/dashboard/PhotoCapture";

/** Compact row returned by member search. */
type MemberHit = {
  id: string;
  fullName: string;
  phone: string;
  photoUrl: string;
  membershipStatus: string;
  qrPayload: string;
};

/** Full profile used for desk actions (sign-in, loans, guest pass). */
type MemberDetail = MemberHit & {
  emergencyContactName: string;
  emergencyContactPhone: string;
  email: string | null;
  waiverSigned: boolean;
  waiverVersion: number;
  parentalConsent: boolean;
  attendances: { id: string; signInTime: string }[];
  loans: {
    id: string;
    equipment: { id: string; label: string };
  }[];
};

/**
 * Main volunteer desk client for finding members and managing attendance.
 */
export function MembersClient() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [selected, setSelected] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);

  /** Staff checkbox: stored photo matches the person at the desk. */
  const [photoVerified, setPhotoVerified] = useState(false);
  /** Toggles the inline PhotoCapture retake panel. */
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  /** Local data-URL draft before upload on retake. */
  const [photoDraft, setPhotoDraft] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);

  /**
   * Loads a member by id and resets photo-verify / retake UI state.
   *
   * @param id - Member cuid
   */
  const loadMember = useCallback(
    async (id: string) => {
      setLoading(true);
      // Selecting a different person invalidates prior confirmation.
      setPhotoVerified(false);
      setUpdatingPhoto(false);
      setPhotoDraft(null);
      try {
        const data = await apiFetch<{ member: MemberDetail }>(
          `/api/members/${id}`
        );
        setSelected(data.member);
      } catch (err) {
        toast.push(err instanceof Error ? err.message : "Load failed", "error");
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    // Deep-link support: /dashboard/members?memberId=...
    const memberId = searchParams.get("memberId");
    if (memberId) loadMember(memberId);
  }, [searchParams, loadMember]);

  /**
   * Searches members by name/phone; auto-selects when exactly one hit.
   */
  async function search() {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ members: MemberHit[] }>(
        `/api/members?q=${encodeURIComponent(q.trim())}`
      );
      setHits(data.members);
      if (data.members.length === 1) {
        await loadMember(data.members[0]!.id);
      }
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Search failed", "error");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Resolves a scanned QR payload (raw or URL-suffixed) to a member profile.
   *
   * @param value - Scanner output string
   */
  async function onQrScan(value: string) {
    try {
      // Accept either a bare payload or a URL ending in the payload.
      const payload = value.includes("/")
        ? value.split("/").pop()!
        : value;
      const data = await apiFetch<{ member: MemberDetail }>(
        `/api/members/by-qr/${encodeURIComponent(payload)}`
      );
      setPhotoVerified(false);
      setUpdatingPhoto(false);
      setPhotoDraft(null);
      setSelected(data.member);
      toast.push(`Found ${data.member.fullName}`);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "QR lookup failed", "error");
    }
  }

  /**
   * Signs the selected member in after photo verification (queues offline).
   */
  async function signIn() {
    if (!selected || !photoVerified) return;
    try {
      const result = await dashboardFetch<{ queued?: boolean }>(
        "/api/attendance/sign-in",
        {
          method: "POST",
          body: JSON.stringify({
            memberId: selected.id,
            photoVerified: true,
          }),
        }
      );
      toast.push(
        result.queued
          ? "Saved offline — will sync when online"
          : "Signed in",
        result.queued ? "warn" : "ok"
      );
      if (!result.queued) await loadMember(selected.id);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Sign-in failed", "error");
    }
  }

  /**
   * Signs the member out; may prompt to force-return outstanding loans.
   *
   * @param force - When true, auto-return equipment and complete sign-out
   */
  async function signOut(force = false) {
    if (!selected) return;
    try {
      const result = await dashboardFetch<{
        needsConfirmation?: boolean;
        message?: string;
        outstandingLoans?: { equipment: { label: string } }[];
        queued?: boolean;
      }>("/api/attendance/sign-out", {
        method: "POST",
        body: JSON.stringify({
          memberId: selected.id,
          forceReturnEquipment: force,
        }),
        allowStatuses: [409],
      });

      if (result.queued) {
        toast.push("Saved offline — will sync when online", "warn");
        return;
      }

      if (result.needsConfirmation) {
        const labels =
          result.outstandingLoans?.map((l) => l.equipment.label).join(", ") ??
          "equipment";
        const ok = window.confirm(
          `${result.message}\n\nOutstanding: ${labels}\n\nForce sign-out and auto-return?`
        );
        if (ok) await signOut(true);
        return;
      }

      toast.push(force ? "Force signed out" : "Signed out");
      await loadMember(selected.id);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Sign-out failed", "error");
    }
  }

  /**
   * Uploads `photoDraft` to replace the selected member's stored photo.
   */
  async function savePhoto() {
    if (!selected || !photoDraft) return;
    setSavingPhoto(true);
    try {
      await uploadMemberPhotoDataUrl(
        photoDraft,
        `/api/members/${selected.id}/photo`
      );
      await loadMember(selected.id);
      toast.push("Photo updated");
      setUpdatingPhoto(false);
      setPhotoDraft(null);
      // New photo requires a fresh visual confirmation before sign-in.
      setPhotoVerified(false);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Photo update failed", "error");
    } finally {
      setSavingPhoto(false);
    }
  }

  // Open attendance rows indicate the member is currently inside.
  const isInside = (selected?.attendances?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Find member</h1>
        <Link
          href="/dashboard/members/register"
          className="min-h-12 rounded-xl bg-emerald-600 px-5 py-3 font-semibold"
        >
          Register new member
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search name or phone"
          className="min-h-12 min-w-[240px] flex-1 rounded-xl border border-slate-600 bg-slate-900 px-4"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="min-h-12 rounded-xl bg-slate-700 px-5 font-semibold"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="min-h-12 rounded-xl bg-amber-500 px-5 font-semibold text-slate-950"
        >
          Scan QR
        </button>
      </div>

      {hits.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hits.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => loadMember(m.id)}
              className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-3 text-left hover:border-emerald-500/50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.photoUrl}
                alt=""
                className="h-14 w-14 rounded-full object-cover bg-slate-800"
              />
              <div>
                <p className="font-semibold">{m.fullName}</p>
                <p className="text-sm text-slate-400">{m.phone}</p>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-start gap-5">
            {/* Large photo for desk identity check before sign-in. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.photoUrl}
              alt=""
              className="h-44 w-44 rounded-2xl object-cover bg-slate-800 ring-2 ring-slate-600"
            />
            <div className="flex-1 space-y-2">
              <h2 className="text-3xl font-bold">{selected.fullName}</h2>
              <p className="text-slate-300">{selected.phone}</p>
              <p className="text-sm text-slate-400">
                Emergency: {selected.emergencyContactName} ·{" "}
                {selected.emergencyContactPhone}
              </p>
              <p className="text-sm">
                Status:{" "}
                <span
                  className={
                    isInside ? "text-emerald-400" : "text-slate-400"
                  }
                >
                  {isInside ? "Inside room" : "Not signed in"}
                </span>
                {selected.loans.length > 0
                  ? ` · ${selected.loans.length} active loan(s)`
                  : ""}
              </p>
              <button
                type="button"
                onClick={() => {
                  setUpdatingPhoto((v) => !v);
                  setPhotoDraft(null);
                }}
                className="min-h-11 rounded-xl bg-slate-700 px-4 font-semibold"
              >
                {updatingPhoto ? "Cancel photo update" : "Update photo"}
              </button>
            </div>
          </div>

          {updatingPhoto ? (
            <div className="mt-4 space-y-3">
              <PhotoCapture value={photoDraft} onChange={setPhotoDraft} />
              <button
                type="button"
                disabled={!photoDraft || savingPhoto}
                onClick={savePhoto}
                className="min-h-12 rounded-xl bg-emerald-600 px-5 font-semibold disabled:opacity-60"
              >
                {savingPhoto ? "Uploading…" : "Save new photo"}
              </button>
            </div>
          ) : null}

          {!isInside ? (
            <label className="mt-5 flex min-h-12 items-start gap-3 rounded-xl border border-slate-600 bg-slate-950/60 p-3">
              <input
                type="checkbox"
                checked={photoVerified}
                onChange={(e) => setPhotoVerified(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-slate-200">
                I confirm this photo matches the person present
              </span>
            </label>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {!isInside ? (
              <button
                type="button"
                onClick={signIn}
                disabled={!photoVerified}
                className="min-h-12 rounded-xl bg-emerald-600 px-5 font-semibold disabled:opacity-50"
              >
                Sign In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => signOut(false)}
                className="min-h-12 rounded-xl bg-red-600 px-5 font-semibold"
              >
                Sign Out
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                router.push(`/dashboard/borrow?memberId=${selected.id}`)
              }
              className="min-h-12 rounded-xl bg-slate-700 px-5 font-semibold"
            >
              Borrow
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(`/dashboard/return?memberId=${selected.id}`)
              }
              className="min-h-12 rounded-xl bg-amber-500 px-5 font-semibold text-slate-950"
            >
              Return
            </button>
            <button
              type="button"
              onClick={() => setGuestOpen(true)}
              className="min-h-12 rounded-xl bg-slate-700 px-5 font-semibold"
            >
              Guest pass
            </button>
          </div>

          {selected.loans.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {selected.loans.map((loan) => (
                <li key={loan.id}>• {loan.equipment.label}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <QrScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={onQrScan}
      />

      {guestOpen && selected ? (
        <GuestPassForm
          hostMemberId={selected.id}
          hostName={selected.fullName}
          onClose={() => setGuestOpen(false)}
        />
      ) : null}
    </div>
  );
}
