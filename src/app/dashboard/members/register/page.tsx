"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { PhotoCapture } from "@/components/dashboard/PhotoCapture";
import { SignaturePad } from "@/components/dashboard/SignaturePad";

export default function RegisterMemberPage() {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    dateOfBirth: "",
    parentalConsent: false,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!photoUrl) {
      toast.push("Profile photo is required", "error");
      return;
    }
    if (!signature.trim()) {
      toast.push("Waiver signature is required", "error");
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch<{
        member: { id: string; fullName: string };
        temporaryPassword: string;
        loginEmail: string;
      }>("/api/members", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          email: form.email || "",
          dateOfBirth: form.dateOfBirth || undefined,
          photoUrl,
          waiverSigned: true,
          waiverSignature: signature,
        }),
      });

      toast.push(
        `Registered ${result.member.fullName}. Temp password: ${result.temporaryPassword}`
      );
      router.push(`/dashboard/members?memberId=${result.member.id}`);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  }

  function field(
    key: keyof typeof form,
    label: string,
    type = "text",
    required = true
  ) {
    return (
      <label className="block space-y-1">
        <span className="text-sm text-slate-300">{label}</span>
        <input
          type={type}
          required={required}
          value={String(form[key])}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              [key]:
                type === "checkbox"
                  ? (e.target as HTMLInputElement).checked
                  : e.target.value,
            }))
          }
          className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-3"
        />
      </label>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">Register new member</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {field("fullName", "Full name *")}
        {field("phone", "Phone *", "tel")}
        {field("email", "Email (optional)", "email", false)}
        {field("dateOfBirth", "Date of birth", "date", false)}
        {field("emergencyContactName", "Emergency contact name *")}
        {field("emergencyContactPhone", "Emergency contact phone *", "tel")}
      </div>

      <PhotoCapture value={photoUrl} onChange={setPhotoUrl} />
      <SignaturePad onChange={setSignature} />

      <label className="flex min-h-12 items-center gap-3">
        <input
          type="checkbox"
          checked={form.parentalConsent}
          onChange={(e) =>
            setForm((f) => ({ ...f, parentalConsent: e.target.checked }))
          }
        />
        <span>Parental consent provided (required for under 18)</span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="min-h-12 w-full rounded-xl bg-emerald-600 text-lg font-semibold disabled:opacity-60"
      >
        {loading ? "Saving…" : "Complete registration"}
      </button>
    </form>
  );
}
