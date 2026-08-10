"use client";

/**
 * Public member self-registration (password + profile photo + government ID + waiver).
 * Account stays PENDING until an admin verifies the government ID and signed waiver.
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  uploadGovernmentIdDataUrl,
  uploadMemberPhotoDataUrl,
} from "@/lib/uploads/client";
import { PhotoCapture } from "@/components/dashboard/PhotoCapture";
import { SignaturePad } from "@/components/dashboard/SignaturePad";
import { WaiverAgreement } from "@/components/dashboard/WaiverAgreement";
import { PasswordField } from "@/components/auth/PasswordField";

/**
 * Self-service registration page: uploads photos first, then creates a PENDING member.
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
export default function PortalRegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // data: URL preview until upload returns a storage filename.
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [govIdPreview, setGovIdPreview] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    dateOfBirth: "",
    parentalConsent: false,
  });

  /**
   * Validates required photos/waiver/password, uploads images, then registers.
   *
   * @author Muhammad Naheen Mahboob
   * @author Mashrur Khandaker
   */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!photoPreview) {
      setError("Profile photo is required");
      return;
    }
    if (!govIdPreview) {
      setError("Government ID photo is required");
      return;
    }
    if (!signature.trim()) {
      setError("Waiver signature is required");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      // Upload before create so the API stores only private filenames, not data URLs.
      const photoUrl = await uploadMemberPhotoDataUrl(
        photoPreview,
        "/api/uploads/registration-photo"
      );
      const governmentIdUrl = await uploadGovernmentIdDataUrl(
        govIdPreview,
        "/api/uploads/registration-government-id"
      );

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          password: form.password,
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: form.emergencyContactPhone,
          dateOfBirth: form.dateOfBirth,
          photoUrl,
          governmentIdUrl,
          waiverSigned: true,
          waiverSignature: signature,
          parentalConsent: form.parentalConsent,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        // Surfaces MX / disposable / uniqueness errors from the API.
        setError(data.error ?? "Registration failed");
        return;
      }
      setDone(true);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Renders a labeled controlled input bound to one form field.
   *
   * @author Muhammad Naheen Mahboob
   * @author Mashrur Khandaker
   */
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

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4 py-10">
        <h1 className="text-2xl font-semibold text-emerald-400">
          Registration submitted
        </h1>
        <p className="text-slate-300">
          An admin will verify your government ID and signed waiver before you
          can sign in. You will use the email and password you just chose once
          approved.
        </p>
        <Link
          href="/portal/login"
          className="min-h-12 rounded-xl bg-emerald-600 px-5 py-3 text-center font-semibold"
        >
          Back to login
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Register as a member</h1>
        <Link href="/portal/login" className="text-sm text-emerald-400">
          Already registered? Sign in
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("fullName", "Full name *")}
          {field("phone", "Phone *", "tel")}
          {field("email", "Email *", "email")}
          {field("dateOfBirth", "Date of birth *", "date")}
          {field("emergencyContactName", "Emergency contact name *")}
          {field("emergencyContactPhone", "Emergency contact phone *", "tel")}
          <PasswordField
            label="Password *"
            value={form.password}
            onChange={(password) => setForm((f) => ({ ...f, password }))}
            autoComplete="new-password"
            minLength={8}
          />
          <PasswordField
            label="Confirm password *"
            value={form.confirmPassword}
            onChange={(confirmPassword) =>
              setForm((f) => ({ ...f, confirmPassword }))
            }
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        <PhotoCapture value={photoPreview} onChange={setPhotoPreview} />
        <PhotoCapture
          value={govIdPreview}
          onChange={setGovIdPreview}
          label="Government ID photo * (legal guardian if under 18)"
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

        {error ? (
          <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !photoPreview || !govIdPreview}
          className="min-h-12 w-full rounded-xl bg-emerald-600 text-lg font-semibold disabled:opacity-60"
        >
          {loading ? "Submitting…" : "Submit registration"}
        </button>
      </form>
    </main>
  );
}
