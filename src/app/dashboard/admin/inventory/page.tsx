"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type Equipment = {
  id: string;
  label: string;
  type: string;
  conditionStatus: string;
  isActive: boolean;
  loans: { member: { fullName: string } }[];
};

const TYPES = [
  "PS5_CONSOLE",
  "PS5_CONTROLLER",
  "SWITCH_CONSOLE",
  "SWITCH_CONTROLLER",
  "TABLE_TENNIS",
  "FOOSBALL",
  "POOL",
  "AIR_HOCKEY",
];

export default function AdminInventoryPage() {
  const toast = useToast();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [label, setLabel] = useState("");
  const [type, setType] = useState("PS5_CONTROLLER");

  async function refresh() {
    const data = await apiFetch<{ equipment: Equipment[] }>(
      "/api/admin/equipment"
    );
    setEquipment(data.equipment);
  }

  useEffect(() => {
    refresh().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
  }, [toast]);

  async function addItem(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/api/admin/equipment", {
        method: "POST",
        body: JSON.stringify({ label, type }),
      });
      setLabel("");
      toast.push("Equipment added");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function patch(id: string, data: Record<string, unknown>) {
    try {
      await apiFetch("/api/admin/equipment", {
        method: "PATCH",
        body: JSON.stringify({ id, ...data }),
      });
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Update failed", "error");
    }
  }

  async function deactivate(id: string) {
    try {
      await apiFetch(`/api/admin/equipment?id=${id}`, { method: "DELETE" });
      toast.push("Deactivated");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Inventory ({equipment.length})</h2>

      <form
        onSubmit={addItem}
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 p-4"
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label e.g. PS5 Controller #25"
          className="min-h-11 min-w-[220px] flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3"
          required
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-3"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-amber-500 px-4 font-semibold text-slate-950"
        >
          Add item
        </button>
      </form>

      <ul className="space-y-2">
        {equipment.map((item) => (
          <li
            key={item.id}
            className={`rounded-xl border px-4 py-3 ${
              item.isActive
                ? "border-slate-700 bg-slate-900/50"
                : "border-slate-800 bg-slate-950/40 opacity-60"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{item.label}</p>
                <p className="text-sm text-slate-400">
                  {item.type} · {item.conditionStatus}
                  {item.loans[0]
                    ? ` · with ${item.loans[0].member.fullName}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={item.conditionStatus}
                  onChange={(e) =>
                    patch(item.id, { conditionStatus: e.target.value })
                  }
                  className="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-2 text-sm"
                >
                  <option value="GOOD">GOOD</option>
                  <option value="MINOR_ISSUE">MINOR_ISSUE</option>
                  <option value="OUT_OF_ORDER">OUT_OF_ORDER</option>
                </select>
                {item.isActive ? (
                  <button
                    type="button"
                    onClick={() => deactivate(item.id)}
                    className="min-h-11 rounded-xl bg-slate-700 px-3 text-sm font-semibold"
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => patch(item.id, { isActive: true })}
                    className="min-h-11 rounded-xl bg-emerald-700 px-3 text-sm font-semibold"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
