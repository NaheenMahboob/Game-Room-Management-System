"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { dashboardFetch } from "@/lib/offline/sync";
import { useToast } from "@/components/ui/Toast";

type Loan = {
  id: string;
  durationMinutes: number;
  alert: string;
  member: { id: string; fullName: string; photoUrl: string };
  equipment: { id: string; label: string };
};

function ReturnInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const memberId = searchParams.get("memberId");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const qs = memberId ? `?memberId=${memberId}` : "";
    const data = await apiFetch<{ loans: Loan[] }>(`/api/loans${qs}`);
    setLoans(data.loans);
  }, [memberId]);

  useEffect(() => {
    refresh().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
  }, [refresh, toast]);

  async function returnOne(loanId: string) {
    try {
      await dashboardFetch("/api/loans/return", {
        method: "POST",
        body: JSON.stringify({
          loanId,
          conditionNotes: notes[loanId] || undefined,
        }),
      });
      toast.push("Returned");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Return failed", "error");
    }
  }

  async function returnAllForMember(id: string) {
    try {
      await dashboardFetch("/api/loans/return", {
        method: "POST",
        body: JSON.stringify({ memberId: id, returnAll: true }),
      });
      toast.push("All items returned");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Return failed", "error");
    }
  }

  const byMember = loans.reduce<Record<string, Loan[]>>((acc, loan) => {
    const key = loan.member.id;
    (acc[key] ??= []).push(loan);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Return equipment</h1>
      {Object.keys(byMember).length === 0 ? (
        <p className="text-slate-400">No active loans.</p>
      ) : (
        Object.entries(byMember).map(([id, memberLoans]) => (
          <section
            key={id}
            className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={memberLoans[0]!.member.photoUrl}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover bg-slate-800"
                />
                <h2 className="text-xl font-semibold">
                  {memberLoans[0]!.member.fullName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => returnAllForMember(id)}
                className="min-h-12 rounded-xl bg-amber-500 px-4 font-semibold text-slate-950"
              >
                Return All
              </button>
            </div>
            <ul className="space-y-3">
              {memberLoans.map((loan) => (
                <li
                  key={loan.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/50 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{loan.equipment.label}</p>
                      <p className="text-sm text-slate-400">
                        {loan.durationMinutes} min · {loan.alert}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => returnOne(loan.id)}
                      className="min-h-12 rounded-xl bg-emerald-600 px-4 font-semibold"
                    >
                      Return
                    </button>
                  </div>
                  <input
                    value={notes[loan.id] ?? ""}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [loan.id]: e.target.value }))
                    }
                    placeholder="Condition notes (optional)"
                    className="mt-2 min-h-12 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 text-sm"
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

export default function ReturnPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <ReturnInner />
    </Suspense>
  );
}
