"use client";

/**
 * Member portal profile: contact edits, QR card, self-service photo update,
 * and “I’m here” check-in request for the volunteer waiting list.
 */

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { apiFetch } from "@/lib/api/client";
import { uploadMemberPhotoDataUrl } from "@/lib/uploads/client";
import { useToast } from "@/components/ui/Toast";
import { PhotoCapture } from "@/components/dashboard/PhotoCapture";

/** Subset of member fields shown and editable in the portal. */
type Member = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  photoUrl: string;
  pendingPhotoUrl?: string | null;
  qrPayload: string;
  membershipStatus: string;
  checkInRequestedAt?: string | null;
  attendances?: { id: string }[];
};

type PortalProfileClientProps = {
  /** Authenticated member's id (from the portal session). */
  memberId: string;
};

/**
 * Renders the logged-in member's profile with check-in, photo retake, and contact save.
 *
 * @param props - Contains the current member id
 */
export function PortalProfileClient({ memberId }: PortalProfileClientProps) {
  const toast = useToast();
  const [member, setMember] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  /** Local preview before multipart upload to `/api/members/[id]/photo`. */
  const [photoDraft, setPhotoDraft] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  /** True while posting/cancelling the desk waiting-list request. */
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [form, setForm] = useState({
    phone: "",
    email: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });
  const qrWrapRef = useRef<HTMLDivElement>(null);

  /**
   * Reloads the member profile from the API into local state.
   */
  async function refreshMember() {
    const data = await apiFetch<{ member: Member }>(`/api/members/${memberId}`);
    setMember(data.member);
    setForm({
      phone: data.member.phone,
      email: data.member.email ?? "",
      emergencyContactName: data.member.emergencyContactName,
      emergencyContactPhone: data.member.emergencyContactPhone,
    });
  }

  useEffect(() => {
    refreshMember().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per memberId
  }, [memberId, toast]);

  /**
   * Persists contact fields via `PATCH /api/members/[id]`.
   */
  async function save() {
    setSaving(true);
    try {
      const data = await apiFetch<{ member: Member }>(
        `/api/members/${memberId}`,
        {
          method: "PATCH",
          body: JSON.stringify(form),
        }
      );
      setMember(data.member);
      toast.push("Profile updated");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Submits a self-service retake — stays pending until staff approve/reject.
   */
  async function savePhoto() {
    if (!photoDraft) return;
    setSavingPhoto(true);
    try {
      await uploadMemberPhotoDataUrl(
        photoDraft,
        `/api/members/${memberId}/photo`
      );
      await refreshMember();
      toast.push(
        "Photo submitted for staff approval. Your current photo stays until approved."
      );
      setUpdatingPhoto(false);
      setPhotoDraft(null);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Photo update failed", "error");
    } finally {
      setSavingPhoto(false);
    }
  }

  /**
   * Places this member on the volunteer “waiting to enter” list.
   */
  async function requestCheckIn() {
    setCheckInBusy(true);
    try {
      await apiFetch("/api/attendance/check-in-request", { method: "POST" });
      await refreshMember();
      toast.push("You’re on the waiting list — a volunteer will let you in");
    } catch (err) {
      toast.push(
        err instanceof Error ? err.message : "Could not request check-in",
        "error"
      );
    } finally {
      setCheckInBusy(false);
    }
  }

  /**
   * Removes this member from the waiting list.
   */
  async function cancelCheckIn() {
    setCheckInBusy(true);
    try {
      await apiFetch("/api/attendance/check-in-request", { method: "DELETE" });
      await refreshMember();
      toast.push("Check-in request cancelled");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not cancel", "error");
    } finally {
      setCheckInBusy(false);
    }
  }

  /**
   * Downloads the QR canvas as a PNG named after the member.
   */
  function downloadQr() {
    const canvas = qrWrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${member?.fullName ?? "member"}-qr.png`;
    a.click();
  }

  if (!member) {
    return <p className="text-slate-400">Loading profile…</p>;
  }

  const isInside = (member.attendances?.length ?? 0) > 0;
  const isWaiting = Boolean(member.checkInRequestedAt) && !isInside;
  const canRequestCheckIn =
    member.membershipStatus === "ACTIVE" && !isInside && !isWaiting;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={member.photoUrl}
          alt=""
          className="h-24 w-24 rounded-2xl object-cover bg-slate-800"
        />
        <div>
          <h1 className="text-3xl font-semibold">{member.fullName}</h1>
          <p className="text-slate-400">{member.membershipStatus}</p>
          {member.pendingPhotoUrl ? (
            <p className="mt-2 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
              A new photo is awaiting volunteer approval. Your current photo is
              still shown until then.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setUpdatingPhoto((v) => !v);
              setPhotoDraft(null);
            }}
            className="mt-2 min-h-10 rounded-xl bg-slate-700 px-3 text-sm font-semibold"
          >
            {updatingPhoto ? "Cancel" : "Update photo"}
          </button>
        </div>
      </div>

      {/* Room entry: member must request before staff can sign them in. */}
      <section className="space-y-3 rounded-2xl border border-emerald-500/30 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold">Game room check-in</h2>
        {isInside ? (
          <p className="text-sm text-emerald-300">
            You are signed in to the room. Ask a volunteer when you are ready to
            leave.
          </p>
        ) : null}
        {isWaiting ? (
          <>
            <p className="text-sm text-amber-200">
              You’re on the waiting list. Show your QR or photo to a volunteer so
              they can let you in.
            </p>
            <button
              type="button"
              disabled={checkInBusy}
              onClick={cancelCheckIn}
              className="min-h-11 rounded-xl bg-slate-700 px-5 font-semibold disabled:opacity-60"
            >
              {checkInBusy ? "Updating…" : "Cancel — I’m not ready"}
            </button>
          </>
        ) : null}
        {canRequestCheckIn ? (
          <>
            <p className="text-sm text-slate-400">
              When you arrive at the game room, tap below so volunteers know you
              are waiting to be let in.
            </p>
            <button
              type="button"
              disabled={checkInBusy}
              onClick={requestCheckIn}
              className="min-h-12 rounded-xl bg-emerald-600 px-5 font-semibold disabled:opacity-60"
            >
              {checkInBusy ? "Requesting…" : "I’m here — request check-in"}
            </button>
          </>
        ) : null}
        {member.membershipStatus === "PENDING" ? (
          <p className="text-sm text-amber-200">
            Your registration is still awaiting photo verification.
          </p>
        ) : null}
      </section>

      {updatingPhoto ? (
        <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <PhotoCapture value={photoDraft} onChange={setPhotoDraft} />
          <button
            type="button"
            disabled={!photoDraft || savingPhoto}
            onClick={savePhoto}
            className="min-h-11 rounded-xl bg-emerald-600 px-5 font-semibold disabled:opacity-60"
          >
            {savingPhoto ? "Uploading…" : "Submit for approval"}
          </button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <h2 className="mb-3 text-lg font-semibold">Member QR card</h2>
        <div
          ref={qrWrapRef}
          className="inline-block rounded-2xl bg-white p-4"
        >
          <QRCodeCanvas value={member.qrPayload} size={200} includeMargin />
        </div>
        <p className="mt-3 font-mono text-sm text-slate-400">
          {member.qrPayload}
        </p>
        <button
          type="button"
          onClick={downloadQr}
          className="mt-3 min-h-11 rounded-xl bg-teal-600 px-4 font-semibold"
        >
          Download QR
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold">Contact details</h2>
        {(
          [
            ["phone", "Phone"],
            ["email", "Email"],
            ["emergencyContactName", "Emergency contact name"],
            ["emergencyContactPhone", "Emergency contact phone"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block space-y-1">
            <span className="text-sm text-slate-400">{label}</span>
            <input
              value={form[key]}
              onChange={(e) =>
                setForm((f) => ({ ...f, [key]: e.target.value }))
              }
              className="min-h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3"
            />
          </label>
        ))}
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="min-h-11 rounded-xl bg-emerald-600 px-5 font-semibold disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </section>
    </div>
  );
}
