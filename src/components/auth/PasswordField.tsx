"use client";

/**
 * Password input with a show/hide toggle for login and registration forms.
 *
 * @author Muhammad Naheen Mahboob
 */

import { useState } from "react";

/**
 * Props for {@link PasswordField}.
 *
 * @author Muhammad Naheen Mahboob
 */
type PasswordFieldProps = {
  /** Visible label above the input. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  id?: string;
};

/**
 * Controlled password field; toggles between `password` and `text` types
 * so members can verify what they typed without leaving the form.
 *
 * @author Muhammad Naheen Mahboob
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = "current-password",
  required = true,
  minLength,
  id,
}: PasswordFieldProps) {
  // Local only — never persisted; resets when the field unmounts.
  const [visible, setVisible] = useState(false);

  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <div className="relative">
        <input
          id={id}
          // Swap type so browsers still honor autocomplete while allowing reveal.
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 pr-20 text-slate-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-slate-400 hover:text-slate-200"
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}
