"use client";

/**
 * Admin volunteer shift schedule by day-of-week.
 * Each day's shift list scrolls when it grows.
 *
 * @author Muhammad Naheen Mahboob
 */

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { ScrollPanel } from "@/components/ui/ScrollPanel";

type User = { id: string; email: string; role: string };
type Shift = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  recurring: boolean;
  volunteer: { id: string; email: string };
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminShiftsPage() {
  const toast = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [volunteers, setVolunteers] = useState<User[]>([]);
  const [form, setForm] = useState({
    volunteerUserId: "",
    dayOfWeek: 1,
    startTime: "16:00",
    endTime: "18:00",
    recurring: true,
  });

  async function refresh() {
    const [shiftRes, userRes] = await Promise.all([
      apiFetch<{ shifts: Shift[] }>("/api/admin/shifts"),
      apiFetch<{ users: User[] }>("/api/admin/users"),
    ]);
    setShifts(shiftRes.shifts);
    const staff = userRes.users.filter(
      (u) => u.role === "VOLUNTEER" || u.role === "ADMIN"
    );
    setVolunteers(staff);
    if (!form.volunteerUserId && staff[0]) {
      setForm((f) => ({ ...f, volunteerUserId: staff[0]!.id }));
    }
  }

  useEffect(() => {
    refresh().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createShift(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/api/admin/shifts", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast.push("Shift created");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function removeShift(id: string) {
    try {
      await apiFetch(`/api/admin/shifts?id=${id}`, { method: "DELETE" });
      toast.push("Shift removed");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Shift schedule</h2>

      <form
        onSubmit={createShift}
        className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <select
          value={form.volunteerUserId}
          onChange={(e) =>
            setForm((f) => ({ ...f, volunteerUserId: e.target.value }))
          }
          className="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-3"
          required
        >
          {volunteers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.email}
            </option>
          ))}
        </select>
        <select
          value={form.dayOfWeek}
          onChange={(e) =>
            setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))
          }
          className="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-3"
        >
          {DAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={form.startTime}
          onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
          className="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-3"
        />
        <input
          type="time"
          value={form.endTime}
          onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
          className="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-3"
        />
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-amber-500 font-semibold text-slate-950"
        >
          Add shift
        </button>
      </form>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {DAYS.map((day, dayIndex) => (
          <section
            key={day}
            className="rounded-2xl border border-slate-700 bg-slate-900/50 p-4"
          >
            <h3 className="mb-3 font-semibold text-amber-200">{day}</h3>
            <ScrollPanel label={`${day} shifts`} density="rows">
              <ul className="space-y-2">
                {shifts
                  .filter((s) => s.dayOfWeek === dayIndex)
                  .map((s) => (
                    <li
                      key={s.id}
                      className="rounded-xl bg-slate-950/60 px-3 py-2 text-sm"
                    >
                      <p className="font-medium">
                        {s.startTime} – {s.endTime}
                      </p>
                      <p className="text-slate-400">{s.volunteer.email}</p>
                      <button
                        type="button"
                        onClick={() => removeShift(s.id)}
                        className="mt-2 text-xs text-red-300 hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                {shifts.filter((s) => s.dayOfWeek === dayIndex).length === 0 ? (
                  <li className="text-sm text-slate-500">No shifts</li>
                ) : null}
              </ul>
            </ScrollPanel>
          </section>
        ))}
      </div>
    </div>
  );
}
