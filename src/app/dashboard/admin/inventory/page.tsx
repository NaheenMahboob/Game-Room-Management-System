"use client";

/**
 * Admin inventory page: manage equipment types, add units, condition, deactivate, delete.
 * Deactivate / Delete stay disabled while an item has an open loan.
 *
 * @author Muhammad Naheen Mahboob
 */

import { FormEvent, useEffect, useMemo, useState } from "react";
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
  typeDef?: { code: string; label: string } | null;
  conditionStatus: string;
  isActive: boolean;
  loans: { member: { fullName: string } }[];
};

/**
 * Catalog type from `GET /api/admin/equipment-types`.
 *
 * @author Muhammad Naheen Mahboob
 */
type EquipmentType = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

/**
 * Admin equipment catalog UI.
 *
 * @author Muhammad Naheen Mahboob
 */
export default function AdminInventoryPage() {
  const toast = useToast();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [label, setLabel] = useState("");
  const [type, setType] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [newTypeLimit, setNewTypeLimit] = useState("");

  const activeTypes = useMemo(
    () => types.filter((t) => t.isActive),
    [types]
  );

  /**
   * Reloads equipment and type catalogs.
   *
   * @author Muhammad Naheen Mahboob
   */
  async function refresh() {
    const [equipData, typesData] = await Promise.all([
      apiFetch<{ equipment: Equipment[] }>("/api/admin/equipment"),
      apiFetch<{ types: EquipmentType[] }>("/api/admin/equipment-types"),
    ]);
    setEquipment(equipData.equipment);
    setTypes(typesData.types);
    const active = typesData.types.filter((t) => t.isActive);
    setType((current) => {
      if (current && active.some((t) => t.code === current)) return current;
      return active[0]?.code ?? "";
    });
  }

  useEffect(() => {
    refresh().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
  }, [toast]);

  /**
   * Creates a new catalog type from the type form.
   *
   * @author Muhammad Naheen Mahboob
   */
  async function addType(e: FormEvent) {
    e.preventDefault();
    try {
      const minutes = newTypeLimit.trim()
        ? Number(newTypeLimit)
        : undefined;
      if (
        minutes != null &&
        (!Number.isFinite(minutes) || minutes <= 0)
      ) {
        toast.push("Time limit must be a positive number of minutes", "error");
        return;
      }
      const data = await apiFetch<{ type: EquipmentType }>(
        "/api/admin/equipment-types",
        {
          method: "POST",
          body: JSON.stringify({
            label: newTypeLabel,
            defaultTimeLimitMinutes: minutes,
          }),
        }
      );
      setNewTypeLabel("");
      setNewTypeLimit("");
      setType(data.type.code);
      toast.push(`Type added: ${data.type.label}`);
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  /**
   * Creates a new catalog item from the top form.
   *
   * @author Muhammad Naheen Mahboob
   */
  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!type) {
      toast.push("Add an equipment type first", "error");
      return;
    }
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

  /**
   * Toggles a type active/inactive.
   *
   * @author Muhammad Naheen Mahboob
   */
  async function setTypeActive(id: string, isActive: boolean) {
    try {
      await apiFetch("/api/admin/equipment-types", {
        method: "PATCH",
        body: JSON.stringify({ id, isActive }),
      });
      toast.push(isActive ? "Type reactivated" : "Type deactivated");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Inventory ({equipment.length})</h2>

      <form
        onSubmit={addType}
        className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4"
      >
        <h3 className="text-sm font-semibold text-slate-200">
          Add equipment type
        </h3>
        <p className="text-xs text-slate-400">
          Use this when a new kind of device arrives (e.g. VR Headset). Then add
          individual units below.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={newTypeLabel}
            onChange={(e) => setNewTypeLabel(e.target.value)}
            placeholder="Type name e.g. VR Headset"
            className="min-h-11 min-w-[220px] flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3"
            required
          />
          <input
            value={newTypeLimit}
            onChange={(e) => setNewTypeLimit(e.target.value)}
            placeholder="Loan limit (minutes, optional)"
            inputMode="numeric"
            className="min-h-11 w-48 rounded-xl border border-slate-600 bg-slate-950 px-3"
          />
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-teal-600 px-4 font-semibold"
          >
            Add type
          </button>
        </div>
        {types.length > 0 ? (
          <ul className="flex flex-wrap gap-2 pt-1 text-xs text-slate-400">
            {types.map((t) => (
              <li
                key={t.id}
                className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1 ${
                  t.isActive
                    ? "border-slate-600 bg-slate-950"
                    : "border-slate-800 opacity-60"
                }`}
              >
                <span>
                  {t.label}{" "}
                  <span className="font-mono text-slate-500">({t.code})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setTypeActive(t.id, !t.isActive)}
                  className="text-teal-300 underline"
                >
                  {t.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

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
          required
          disabled={activeTypes.length === 0}
        >
          {activeTypes.length === 0 ? (
            <option value="">No types yet</option>
          ) : (
            activeTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))
          )}
        </select>
        <button
          type="submit"
          disabled={activeTypes.length === 0}
          className="min-h-11 rounded-xl bg-amber-500 px-4 font-semibold text-slate-950 disabled:opacity-50"
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
                    {item.typeDef?.label ?? item.type} · {item.conditionStatus}
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
