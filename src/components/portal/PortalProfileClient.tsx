"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type Member = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  photoUrl: string;
  qrPayload: string;
  membershipStatus: string;
};

export function PortalProfileClient({ memberId }: { memberId: string }) {
  const toast = useToast();
  const [member, setMember] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone: "",
    email: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });
  const qrWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ member: Member }>(`/api/members/${memberId}`)
      .then((data) => {
        setMember(data.member);
        setForm({
          phone: data.member.phone,
          email: data.member.email ?? "",
          emergencyContactName: data.member.emergencyContactName,
          emergencyContactPhone: data.member.emergencyContactPhone,
        });
      })
      .catch((err) =>
        toast.push(err instanceof Error ? err.message : "Load failed", "error")
      );
  }, [memberId, toast]);

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
        </div>
      </div>

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
