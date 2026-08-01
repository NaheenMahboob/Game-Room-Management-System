"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type Log = {
  id: string;
  actionType: string;
  timestamp: string;
  details: unknown;
  performedBy: { email: string; role: string };
  member: { fullName: string } | null;
  equipment: { label: string } | null;
};

export default function AdminAuditPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<Log[]>([]);
  const [actionType, setActionType] = useState("");

  async function refresh(filter = actionType) {
    const qs = filter ? `?actionType=${encodeURIComponent(filter)}&limit=100` : "?limit=100";
    const data = await apiFetch<{ logs: Log[] }>(`/api/admin/audit${qs}`);
    setLogs(data.logs);
  }

  useEffect(() => {
    refresh().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Audit log</h2>
        <div className="flex gap-2">
          <input
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            placeholder="Filter action type"
            className="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-3"
          />
          <button
            type="button"
            onClick={() => refresh()}
            className="min-h-11 rounded-xl bg-slate-700 px-4 font-semibold"
          >
            Filter
          </button>
          <a
            href="/api/admin/reports/csv?type=audit"
            className="min-h-11 rounded-xl bg-amber-500 px-4 py-2.5 font-semibold text-slate-950"
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-700">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-300">
            <tr>
              <th className="px-3 py-3">Time</th>
              <th className="px-3 py-3">Action</th>
              <th className="px-3 py-3">User</th>
              <th className="px-3 py-3">Member</th>
              <th className="px-3 py-3">Equipment</th>
              <th className="px-3 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-800">
                <td className="px-3 py-2 whitespace-nowrap text-slate-400">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-mono text-amber-200">
                  {log.actionType}
                </td>
                <td className="px-3 py-2">{log.performedBy.email}</td>
                <td className="px-3 py-2">{log.member?.fullName ?? "—"}</td>
                <td className="px-3 py-2">{log.equipment?.label ?? "—"}</td>
                <td className="px-3 py-2 max-w-xs truncate font-mono text-xs text-slate-400">
                  {JSON.stringify(log.details)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
