"use client";

/**
 * Desk registration form (volunteer or admin tablet).
 * Uploads profile photo + government ID, then creates a PENDING member with a
 * signed waiver PDF. An admin must verify gov ID + waiver before the account
 * becomes ACTIVE. Shows a credentials panel (email + temp password) after submit.
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import {
  uploadGovernmentIdDataUrl,
  uploadMemberPhotoDataUrl,
} from "@/lib/uploads/client";
import { useToast } from "@/components/ui/Toast";
import { PhotoCapture } from "@/components/dashboard/PhotoCapture";
import { SignaturePad } from "@/components/dashboard/SignaturePad";
import { WaiverAgreement } from "@/components/dashboard/WaiverAgreement";

/**
 * Multi-step registration UI: details → photos → waiver → credentials panel.
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
export default function RegisterMemberPage() {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [govIdPreview, setGovIdPreview] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [credentials, setCredentials] = useState<{
    memberId: string;
    fullName: string;
    loginEmail: string;
    temporaryPassword: string;
  } | null>(null);
  /** Done stays disabled until credentials are copied.
   * @author Muhammad Naheen Mahboob
   * @author Mashrur Khandaker
   */
  const [credentialsCopied, setCredentialsCopied] = useState(false);
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
    if (!photoPreview) {
      toast.push("Profile photo is required", "error");
      return;
    }
    if (!govIdPreview) {
      toast.push("Government ID photo is required", "error");
      return;
    }
    if (!signature.trim()) {
      toast.push("Waiver signature is required", "error");
      return;
    }

    setLoading(true);
    try {
      const photoUrl = await uploadMemberPhotoDataUrl(
        photoPreview,
        "/api/uploads/member-photo"
      );
      const governmentIdUrl = await uploadGovernmentIdDataUrl(
        govIdPreview,
        "/api/uploads/member-government-id"
      );

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
          governmentIdUrl,
          waiverSigned: true,
          waiverSignature: signature,
        }),
      });

      setCredentials({
        memberId: result.member.id,
        fullName: result.member.fullName,
        loginEmail: result.loginEmail,
        temporaryPassword: result.temporaryPassword,
      });
      setCredentialsCopied(false);
    } catch (err) {
      toast.push(
        err instanceof Error ? err.message : "Registration failed",
        "error"
      );
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

  if (credentials) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-amber-500/40 bg-slate-900/80 p-6">
        <h1 className="text-2xl font-semibold text-amber-300">
          Registration submitted — pending admin verification
        </h1>
        <p className="text-slate-300">
          Copy these credentials for {credentials.fullName}. An admin must
          verify the government ID and signed waiver before they can sign in.
          They must change the password on first portal login after approval.
        </p>
        <div className="select-all rounded-xl bg-slate-950 p-4 font-mono text-sm">
          <p>Email: {credentials.loginEmail}</p>
          <p>Temp password: {credentials.temporaryPassword}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-12 rounded-xl bg-emerald-600 px-5 font-semibold"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `Email: ${credentials.loginEmail}\nTemp password: ${credentials.temporaryPassword}`
                );
                setCredentialsCopied(true);
                toast.push("Copied — you can continue when ready");
              } catch {
                const ok = window.confirm(
                  "Clipboard copy failed. Have you written down or selected the temporary password?\n\nOK = yes, enable Done. Cancel = stay on this panel."
                );
                if (ok) {
                  setCredentialsCopied(true);
                  toast.push(
                    "Done enabled — password will not be shown again",
                    "warn"
                  );
                } else {
                  toast.push(
                    "Select the password text and copy it manually, then try Copy again",
                    "error"
                  );
                }
              }
            }}
          >
            {credentialsCopied ? "Copied" : "Copy credentials"}
          </button>
          <button
            type="button"
            disabled={!credentialsCopied}
            title={
              credentialsCopied
                ? undefined
                : "Copy credentials before continuing"
            }
            className="min-h-12 rounded-xl bg-slate-700 px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => router.push("/dashboard/members/pending")}
          >
            Done — open pending queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Register new member</h1>
        <p className="mt-1 text-sm text-slate-400">
          Capture a profile photo and a government ID photo, then have them sign
          the waiver. An admin reviews ID + waiver before the account is
          activated.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {field("fullName", "Full name *")}
        {field("phone", "Phone *", "tel")}
        {field("email", "Email (recommended)", "email", false)}
        {field("dateOfBirth", "Date of birth", "date", false)}
        {field("emergencyContactName", "Emergency contact name *")}
        {field("emergencyContactPhone", "Emergency contact phone *", "tel")}
      </div>

      <PhotoCapture value={photoPreview} onChange={setPhotoPreview} />
      <PhotoCapture
        value={govIdPreview}
        onChange={setGovIdPreview}
        label="Government ID photo *"
      />
      <WaiverAgreement />
      <SignaturePad onChange={setSignature} />

      <label className="flex min-h-12 items-center gap-3">
        <input
          type="checkbox"
          checked={form.parentalConsent}
          onChange={(e) =>
            setForm((f) => ({ ...f, parentalConsent: e.target.checked }))
          }
        />
        <span>
          Parent/guardian consent provided (required under 18 — guardian must
          sign and accepts payment responsibility for broken equipment)
        </span>
      </label>

      <button
        type="submit"
        disabled={loading || !photoPreview || !govIdPreview}
        className="min-h-12 w-full rounded-xl bg-emerald-600 text-lg font-semibold disabled:opacity-60"
      >
        {loading ? "Saving…" : "Submit for admin verification"}
      </button>
    </form>
  );
}
