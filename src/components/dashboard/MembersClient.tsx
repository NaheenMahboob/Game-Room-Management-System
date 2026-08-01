"use client";

/**
 * Volunteer desk member identify panel.
 *
 * Only shows members who requested check-in (“I’m here” in the portal, or
 * desk registration). Staff verify the photo, then sign them into the room.
 * Already-inside members can still be opened via deep link / QR for sign-out.
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

/** Compact row on the waiting / search list. */
type MemberHit = {
  id: string;
  fullName: string;
  phone: string;
  photoUrl: string;
  membershipStatus: string;
  qrPayload: string;
  checkInRequestedAt?: string | null;
};

/** Full profile used for desk actions (sign-in, loans, guest pass). */
type MemberDetail = MemberHit & {
  emergencyContactName: string;
  emergencyContactPhone: string;
  email: string | null;
  waiverSigned: boolean;
  waiverVersion: number;
  parentalConsent: boolean;
  pendingPhotoUrl?: string | null;
  attendances: { id: string; signInTime: string }[];
  loans: {
    id: string;
    equipment: { id: string; label: string };
  }[];
};

/**
 * Main volunteer desk client: waiting list + gated sign-in.
 */
export function MembersClient() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState("");
  /** Members waiting to be let in (filtered search or full waiting list). */
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

  /**
   * Refreshes the waiting list (optionally filtered by name/phone).
   *
   * @param query - Optional search string; empty = full waiting list
   */
  const refreshWaiting = useCallback(
    async (query = "") => {
      setLoading(true);
      try {
        const path = query.trim()
          ? `/api/members?q=${encodeURIComponent(query.trim())}`
          : "/api/members";
        const data = await apiFetch<{ members: MemberHit[] }>(path);
        setHits(data.members);
      } catch (err) {
        toast.push(
          err instanceof Error ? err.message : "Could not load waiting list",
          "error"
        );
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    // Deep-link support: /dashboard/members?memberId=... (e.g. from Currently inside).
    const memberId = searchParams.get("memberId");
    if (memberId) {
      loadMember(memberId);
    }
  }, [searchParams, loadMember]);

  useEffect(() => {
    // Default view: only people who asked to be let in.
    refreshWaiting("").catch(() => undefined);
    const id = window.setInterval(() => {
      // Poll the full waiting list; search filter is applied on demand.
      refreshWaiting("").catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(id);
  }, [refreshWaiting]);

  /**
   * Filters the waiting list by name/phone; auto-selects a single hit.
   */
  async function search() {
    setLoading(true);
    try {
      const path = q.trim()
        ? `/api/members?q=${encodeURIComponent(q.trim())}`
        : "/api/members";
      const data = await apiFetch<{ members: MemberHit[] }>(path);
      setHits(data.members);
      if (data.members.length === 1) {
        await loadMember(data.members[0]!.id);
      } else if (data.members.length === 0) {
        toast.push("No waiting members match that search", "warn");
      }
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Search failed", "error");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Resolves a scanned QR payload. Rejects members who are not waiting
   * (unless already inside for sign-out).
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
      await refreshWaiting(q);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "QR lookup failed", "error");
    }
  }

  /**
   * Signs the selected waiting member in after photo verification.
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
      if (!result.queued) {
        await loadMember(selected.id);
        await refreshWaiting(q);
      }
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
        queued?: boolean;
      }>("/api/attendance/sign-out", {
        method: "POST",
        body: JSON.stringify({
          memberId: selected.id,
          forceReturnEquipment: force,
        }),
      });
      if (result.needsConfirmation) {
        const ok = window.confirm(
          result.message ??
            "Member still has equipment out. Force return and sign out?"
        );
        if (ok) await signOut(true);
        return;
      }
      if (result.queued) {
        toast.push("Saved offline — will sync when online", "warn");
      } else {
        toast.push("Signed out");
        await loadMember(selected.id);
        await refreshWaiting(q);
      }
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Sign-out failed", "error");
    }
  }

  /**
   * Staff retake: uploads immediately (live photo) for another member.
   */
  async function savePhoto() {
    if (!selected || !photoDraft) return;
    setSavingPhoto(true);
    try {
      await uploadMemberPhotoDataUrl(
        photoDraft,
        `/api/members/${selected.id}/photo`
      );
      toast.push("Photo updated");
      setUpdatingPhoto(false);
      setPhotoDraft(null);
      await loadMember(selected.id);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Photo update failed", "error");
    } finally {
      setSavingPhoto(false);
    }
  }

  // Open attendance rows indicate the member is currently inside.
  const isInside = (selected?.attendances?.length ?? 0) > 0;
  // Waiting for desk sign-in (portal “I’m here” / desk register).
  const isWaiting =
    Boolean(selected?.checkInRequestedAt) &&
    !isInside &&
    selected?.membershipStatus === "ACTIVE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Waiting to enter</h1>
          <p className="text-sm text-slate-400">
            Only members who tapped “I’m here” in the portal (or were just
            registered at the desk) appear here.
          </p>
        </div>
        <Link
          href="/dashboard/members/register"
          className="min-h-12 rounded-xl bg-emerald-600 px-5 py-3 font-semibold"
        >
          Register new member
        </Link>
        <Link
          href="/dashboard/members/pending"
          className="min-h-12 rounded-xl bg-amber-500 px-5 py-3 font-semibold text-slate-950"
        >
          Pending verifications
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Filter waiting list by name or phone"
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
          onClick={() => refreshWaiting(q)}
          disabled={loading}
          className="min-h-12 rounded-xl bg-slate-700 px-5 font-semibold"
        >
          Refresh
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
                {m.checkInRequestedAt ? (
                  <p className="mt-1 text-xs font-semibold text-emerald-400">
                    Waiting since{" "}
                    {new Date(m.checkInRequestedAt).toLocaleTimeString()}
                  </p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-700 px-4 py-8 text-center text-slate-400">
          {loading
            ? "Loading…"
            : "Nobody is waiting to be let in. Members tap “I’m here” in the portal first."}
        </p>
      )}

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
              {selected.membershipStatus === "PENDING" ? (
                <p className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
                  Registration awaiting photo verification.{" "}
                  <Link
                    href="/dashboard/members/pending"
                    className="font-semibold underline"
                  >
                    Open pending queue
                  </Link>
                </p>
              ) : null}
              {selected.membershipStatus === "INACTIVE" ? (
                <p className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                  Membership is inactive — sign-in is blocked.
                </p>
              ) : null}
              {!isInside &&
              selected.membershipStatus === "ACTIVE" &&
              !selected.checkInRequestedAt ? (
                <p className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
                  Not on the waiting list. Ask them to open the member portal and
                  tap “I’m here” before you can sign them in.
                </p>
              ) : null}
              {selected.pendingPhotoUrl ? (
                <p className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
                  Photo retake awaiting approval.{" "}
                  <Link
                    href="/dashboard/members/pending"
                    className="font-semibold underline"
                  >
                    Review in pending queue
                  </Link>
                </p>
              ) : null}
              <p className="text-slate-300">{selected.phone}</p>
              <p className="text-sm text-slate-400">
                Emergency: {selected.emergencyContactName} ·{" "}
                {selected.emergencyContactPhone}
              </p>
              <p className="text-sm">
                Status:{" "}
                <span
                  className={
                    isInside
                      ? "text-emerald-400"
                      : isWaiting
                        ? "text-amber-300"
                        : "text-slate-400"
                  }
                >
                  {isInside
                    ? "Inside room"
                    : isWaiting
                      ? "Waiting to enter"
                      : "Not signed in"}
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

          {isWaiting ? (
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
            {isWaiting ? (
              <button
                type="button"
                onClick={signIn}
                disabled={!photoVerified}
                className="min-h-12 rounded-xl bg-emerald-600 px-5 font-semibold disabled:opacity-50"
              >
                Sign In
              </button>
            ) : null}
            {selected.membershipStatus === "PENDING" ? (
              <Link
                href="/dashboard/members/pending"
                className="inline-flex min-h-12 items-center rounded-xl bg-amber-500 px-5 font-semibold text-slate-950"
              >
                Go to pending queue
              </Link>
            ) : null}
            {isInside ? (
              <button
                type="button"
                onClick={() => signOut(false)}
                className="min-h-12 rounded-xl bg-red-600 px-5 font-semibold"
              >
                Sign Out
              </button>
            ) : null}
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
