"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type Setting = { id: string; key: string; value: string };

const EDITABLE = [
  "openingHours",
  "maxSessionDuration",
  "guestLimit",
  "waiverVersion",
  "autoMinorIssueOnNotes",
  "communityRules",
  "membershipInfo",
  "equipmentTimeLimits",
];

export default function AdminSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch<{ settings: Setting[] }>("/api/admin/settings")
      .then((data) => {
        const map: Record<string, string> = {};
        for (const s of data.settings) map[s.key] = s.value;
        setSettings(map);
      })
      .catch((err) =>
        toast.push(err instanceof Error ? err.message : "Load failed", "error")
      );
  }, [toast]);

  async function save(key: string) {
    try {
      await apiFetch("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ key, value: settings[key] ?? "" }),
      });
      toast.push(`Saved ${key}`);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Save failed", "error");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">System settings</h2>
      {EDITABLE.map((key) => (
        <div
          key={key}
          className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4"
        >
          <label className="block space-y-2">
            <span className="font-mono text-sm text-amber-200">{key}</span>
            <textarea
              value={settings[key] ?? ""}
              onChange={(e) =>
                setSettings((s) => ({ ...s, [key]: e.target.value }))
              }
              className="min-h-24 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => save(key)}
            className="mt-2 min-h-11 rounded-xl bg-amber-500 px-4 font-semibold text-slate-950"
          >
            Save
          </button>
        </div>
      ))}
    </div>
  );
}
