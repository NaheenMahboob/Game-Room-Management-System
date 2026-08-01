"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

export function GuestPassForm({
  hostMemberId,
  hostName,
  onClose,
}: {
  hostMemberId: string;
  hostName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const data = await apiFetch<{
        guestPass: { id: string; displayName: string };
      }>("/api/guests", {
        method: "POST",
        body: JSON.stringify({ hostMemberId, guestName, guestPhone }),
      });
      await apiFetch(`/api/guests/${data.guestPass.id}`, { method: "POST" });
      toast.push(`Issued ${data.guestPass.displayName} and signed in`);
      onClose();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <h2 className="text-xl font-semibold">Guest of {hostName}</h2>
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Guest name"
          className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-3"
        />
        <input
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          placeholder="Guest phone"
          className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-3"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 flex-1 rounded-xl bg-slate-700 font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || !guestName || !guestPhone}
            onClick={submit}
            className="min-h-12 flex-1 rounded-xl bg-emerald-600 font-semibold disabled:opacity-60"
          >
            Issue & sign in
          </button>
        </div>
      </div>
    </div>
  );
}
