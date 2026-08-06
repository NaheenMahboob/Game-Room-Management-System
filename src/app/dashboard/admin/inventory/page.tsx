"use client";

/**
 * Admin inventory page: add, condition-update, deactivate, and hard-delete equipment.
 * Deactivate / Delete stay disabled while an item has an open loan.
 * Catalog rows are shown in a scroll panel so the list stays manageable.
 *
 * @author Muhammad Naheen Mahboob
 */

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { ScrollPanel } from "@/components/ui/ScrollPanel";

/**
 * Equipment row as returned by `GET /api/admin/equipment`.
 *
 * @author Muhammad Naheen Mahboob
 */
type Equipment = {
  id: string;
  label: string;
  type: string;
  conditionStatus: string;
  isActive: boolean;
  loans: { member: { fullName: string } }[];
};

/** Catalog type options shown in the add-item form. */
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

/**
 * Admin equipment catalog UI.
 *
 * @author Muhammad Naheen Mahboob
 */
export default function AdminInventoryPage() {
  const toast = useToast();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [label, setLabel] = useState("");
  const [type, setType] = useState("PS5_CONTROLLER");

  /**
   * Reloads the full equipment list from the admin API.
   *
   * @author Muhammad Naheen Mahboob
   */
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

  /**
   * Creates a new catalog item from the top form.
   *
   * @author Muhammad Naheen Mahboob
   */
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

  /**
   * Patches fields on one item (condition, reactivate, etc.).
   *
   * @author Muhammad Naheen Mahboob
   */
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

  /**
   * Soft-deactivates via DELETE without `hard` (API also blocks open loans).
   *
   * @author Muhammad Naheen Mahboob
   */
  async function deactivate(id: string) {
    try {
      await apiFetch(`/api/admin/equipment?id=${id}`, { method: "DELETE" });
      toast.push("Deactivated");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  /**
   * Permanently removes an item after confirm (`hard=true`).
   *
   * @author Muhammad Naheen Mahboob
   */
  async function hardDelete(id: string, itemLabel: string) {
    const ok = window.confirm(
      `Permanently delete "${itemLabel}"?\n\nThis cannot be undone. Only allowed when the item is not on loan.`
    );
    if (!ok) return;
    try {
      await apiFetch(
        `/api/admin/equipment?id=${encodeURIComponent(id)}&hard=true`,
        { method: "DELETE" }
      );
      toast.push("Deleted");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Delete failed", "error");
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

      <ScrollPanel label="Equipment inventory">
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
                      // Mirror API: no deactivate while loaned.
                      disabled={item.loans.length > 0}
                      title={
                        item.loans.length > 0
                          ? "Return the loan before deactivating"
                          : undefined
                      }
                      onClick={() => deactivate(item.id)}
                      className="min-h-11 rounded-xl bg-slate-700 px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
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
                  <button
                    type="button"
                    disabled={item.loans.length > 0}
                    title={
                      item.loans.length > 0
                        ? "Return the loan before deleting"
                        : "Permanently delete this item"
                    }
                    onClick={() => hardDelete(item.id, item.label)}
                    className="min-h-11 rounded-xl bg-red-900/80 px-3 text-sm font-semibold text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </ScrollPanel>
    </div>
  );
}
