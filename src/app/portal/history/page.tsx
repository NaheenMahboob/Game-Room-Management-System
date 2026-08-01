"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type Attendance = {
  id: string;
  signInTime: string;
  signOutTime: string | null;
};

type Loan = {
  id: string;
  borrowedAt: string;
  returnedAt: string | null;
  equipment: { label: string; type: string };
};

export default function PortalHistoryPage() {
  const toast = useToast();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    apiFetch<{ attendance: Attendance[]; loans: Loan[] }>(
      "/api/portal/history"
    )
      .then((data) => {
        setAttendance(data.attendance);
        setLoans(data.loans);
      })
      .catch((err) =>
        toast.push(err instanceof Error ? err.message : "Load failed", "error")
      );
  }, [toast]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">My history</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">Attendance</h2>
        {attendance.length === 0 ? (
          <p className="text-slate-400">No visits yet.</p>
        ) : (
          <ul className="space-y-2">
            {attendance.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm"
              >
                <p>
                  In: {new Date(row.signInTime).toLocaleString()}
                </p>
                <p className="text-slate-400">
                  Out:{" "}
                  {row.signOutTime
                    ? new Date(row.signOutTime).toLocaleString()
                    : "Still inside"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">Equipment loans</h2>
        {loans.length === 0 ? (
          <p className="text-slate-400">No loans yet.</p>
        ) : (
          <ul className="space-y-2">
            {loans.map((loan) => {
              const start = new Date(loan.borrowedAt).getTime();
              const end = loan.returnedAt
                ? new Date(loan.returnedAt).getTime()
                : Date.now();
              const mins = Math.max(0, Math.floor((end - start) / 60000));
              return (
                <li
                  key={loan.id}
                  className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm"
                >
                  <p className="font-medium">{loan.equipment.label}</p>
                  <p className="text-slate-400">
                    {new Date(loan.borrowedAt).toLocaleString()} · {mins} min
                    {loan.returnedAt ? "" : " · active"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
