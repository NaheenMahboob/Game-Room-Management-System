"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type SessionRow = {
  id: string;
  signInTime: string;
  durationMinutes: number;
  sessionAlert: "ok" | "warning" | "overdue";
  member: { id: string; fullName: string; photoUrl: string };
};

export default function AttendancePage() {
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [totalInside, setTotalInside] = useState(0);

  const refresh = useCallback(async () => {
    const data = await apiFetch<{
      sessions: SessionRow[];
      occupancy: { totalInside: number };
    }>("/api/attendance?active=true");
    setSessions(data.sessions);
    setTotalInside(data.occupancy.totalInside);
  }, []);

  useEffect(() => {
    refresh().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
    const id = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(id);
  }, [refresh, toast]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Currently inside</h1>
        <p className="text-lg font-bold text-emerald-400">{totalInside}</p>
      </div>
      <ul className="space-y-3">
        {sessions.map((s) => (
          <li
            key={s.id}
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
              s.sessionAlert === "overdue"
                ? "border-red-500/50 bg-red-950/30"
                : s.sessionAlert === "warning"
                  ? "border-amber-500/50 bg-amber-950/30"
                  : "border-slate-700 bg-slate-900/60"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.member.photoUrl}
                alt=""
                className="h-12 w-12 rounded-full object-cover bg-slate-800"
              />
              <div>
                <p className="font-semibold">{s.member.fullName}</p>
                <p className="text-sm text-slate-400">
                  {s.durationMinutes} min inside
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/members?memberId=${s.member.id}`}
              className="min-h-12 rounded-xl bg-slate-700 px-4 py-3 font-semibold"
            >
              Open
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
