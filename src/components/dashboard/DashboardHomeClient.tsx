"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type Occupancy = {
  membersInside: number;
  guestsInside: number;
  totalInside: number;
};

type Loan = {
  id: string;
  durationMinutes: number;
  alert: "ok" | "warning" | "overdue";
  member: { id: string; fullName: string; photoUrl: string };
  equipment: { id: string; label: string; type: string };
};

type ChecklistState = {
  equipmentCountVerified: boolean;
  damageChecked: boolean;
  previousNotesReviewed: boolean;
  occupancyConfirmed: boolean;
  announcementsReviewed: boolean;
  notes: string;
};

const emptyChecklist: ChecklistState = {
  equipmentCountVerified: false,
  damageChecked: false,
  previousNotesReviewed: false,
  occupancyConfirmed: false,
  announcementsReviewed: false,
  notes: "",
};

export function DashboardHomeClient() {
  const toast = useToast();
  const [occupancy, setOccupancy] = useState<Occupancy | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [checklist, setChecklist] = useState<ChecklistState>(emptyChecklist);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [occ, loanRes] = await Promise.all([
        apiFetch<{ occupancy: Occupancy }>("/api/public/occupancy"),
        apiFetch<{ loans: Loan[] }>("/api/loans"),
      ]);
      setOccupancy(occ.occupancy);
      setLoans(loanRes.loans);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed to load", "error");
    }
  }, [toast]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 15000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function completeChecklist() {
    setSavingChecklist(true);
    try {
      await apiFetch("/api/shifts/checklist", {
        method: "POST",
        body: JSON.stringify(checklist),
      });
      toast.push("Shift checklist saved");
      setChecklist(emptyChecklist);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSavingChecklist(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <p className="text-sm text-slate-400">Inside now</p>
          <p className="mt-2 text-4xl font-bold text-emerald-400">
            {occupancy?.totalInside ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <p className="text-sm text-slate-400">Items in use</p>
          <p className="mt-2 text-4xl font-bold text-amber-300">
            {loans.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <p className="text-sm text-slate-400">Members / guests</p>
          <p className="mt-2 text-2xl font-semibold">
            {occupancy
              ? `${occupancy.membersInside} / ${occupancy.guestsInside}`
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/borrow"
          className="flex min-h-28 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold hover:bg-emerald-500"
        >
          Borrow Equipment
        </Link>
        <Link
          href="/dashboard/return"
          className="flex min-h-28 items-center justify-center rounded-2xl bg-amber-500 text-2xl font-bold text-slate-950 hover:bg-amber-400"
        >
          Return Equipment
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Active loans</h2>
          <button
            type="button"
            onClick={refresh}
            className="min-h-12 rounded-xl bg-slate-800 px-4 font-semibold"
          >
            Refresh
          </button>
        </div>
        {loans.length === 0 ? (
          <p className="text-slate-400">No equipment checked out.</p>
        ) : (
          <ul className="space-y-3">
            {loans.map((loan) => (
              <li
                key={loan.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                  loan.alert === "overdue"
                    ? "border-red-500/50 bg-red-950/30"
                    : loan.alert === "warning"
                      ? "border-amber-500/50 bg-amber-950/30"
                      : "border-slate-700 bg-slate-950/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={loan.member.photoUrl}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover bg-slate-800"
                  />
                  <div>
                    <p className="font-semibold">{loan.member.fullName}</p>
                    <p className="text-sm text-slate-400">
                      {loan.equipment.label} · {loan.durationMinutes} min
                    </p>
                  </div>
                </div>
                <Link
                  href={`/dashboard/members?memberId=${loan.member.id}`}
                  className="min-h-12 rounded-xl bg-slate-700 px-4 py-3 text-sm font-semibold"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <h2 className="mb-4 text-xl font-semibold">Start-of-shift checklist</h2>
        <div className="space-y-3">
          {(
            [
              ["equipmentCountVerified", "Count and verify all equipment is present"],
              ["damageChecked", "Check all equipment for visible damage"],
              ["previousNotesReviewed", "Review notes from previous shift"],
              ["occupancyConfirmed", "Confirm room occupancy matches headcount"],
              ["announcementsReviewed", "Review today’s announcements and events"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex min-h-12 items-center gap-3 rounded-xl bg-slate-950/50 px-3"
            >
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={checklist[key]}
                onChange={(e) =>
                  setChecklist((c) => ({ ...c, [key]: e.target.checked }))
                }
              />
              <span>{label}</span>
            </label>
          ))}
          <textarea
            value={checklist.notes}
            onChange={(e) =>
              setChecklist((c) => ({ ...c, notes: e.target.value }))
            }
            placeholder="Notes for the next volunteer"
            className="min-h-24 w-full rounded-xl border border-slate-600 bg-slate-950 p-3"
          />
          <button
            type="button"
            disabled={savingChecklist}
            onClick={completeChecklist}
            className="min-h-12 rounded-xl bg-emerald-600 px-5 font-semibold disabled:opacity-60"
          >
            {savingChecklist ? "Saving…" : "Complete checklist"}
          </button>
        </div>
      </section>
    </div>
  );
}
