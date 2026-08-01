"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { dashboardFetch } from "@/lib/offline/sync";
import { useToast } from "@/components/ui/Toast";

type EquipmentItem = {
  id: string;
  label: string;
  type: string;
  conditionStatus: string;
  available: boolean;
  activeLoan: { member: { fullName: string } } | null;
  queueEntries: { id: string; member: { id: string; fullName: string } }[];
};

type MemberHit = { id: string; fullName: string; photoUrl: string };

function BorrowInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [memberId, setMemberId] = useState(searchParams.get("memberId") ?? "");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberHits, setMemberHits] = useState<MemberHit[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberHit | null>(null);

  const loadEquipment = useCallback(async () => {
    const data = await apiFetch<{ equipment: EquipmentItem[] }>("/api/equipment");
    setEquipment(data.equipment);
  }, []);

  useEffect(() => {
    loadEquipment().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
  }, [loadEquipment, toast]);

  useEffect(() => {
    if (!memberId) return;
    apiFetch<{ member: MemberHit }>(`/api/members/${memberId}`)
      .then((d) => setSelectedMember(d.member))
      .catch(() => undefined);
  }, [memberId]);

  const grouped = useMemo(() => {
    const map = new Map<string, EquipmentItem[]>();
    for (const item of equipment) {
      const list = map.get(item.type) ?? [];
      list.push(item);
      map.set(item.type, list);
    }
    return Array.from(map.entries());
  }, [equipment]);

  function toggle(id: string, available: boolean) {
    if (!available) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function searchMembers() {
    const data = await apiFetch<{ members: MemberHit[] }>(
      `/api/members?q=${encodeURIComponent(memberQuery)}`
    );
    setMemberHits(data.members);
  }

  async function confirmBorrow() {
    if (!memberId || selectedIds.length === 0) {
      toast.push("Select a member and at least one item", "warn");
      return;
    }
    try {
      const result = await dashboardFetch<{ queued?: boolean }>("/api/loans", {
        method: "POST",
        body: JSON.stringify({ memberId, equipmentIds: selectedIds }),
      });
      toast.push(
        result.queued
          ? "Saved offline — will sync when online"
          : "Equipment borrowed",
        result.queued ? "warn" : "ok"
      );
      setSelectedIds([]);
      await loadEquipment();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Borrow failed", "error");
    }
  }

  async function addToQueue(equipmentId: string) {
    if (!memberId) {
      toast.push("Select a member first", "warn");
      return;
    }
    try {
      await apiFetch("/api/queue", {
        method: "POST",
        body: JSON.stringify({ equipmentId, memberId }),
      });
      toast.push("Added to waiting queue");
      await loadEquipment();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Queue failed", "error");
    }
  }

  function statusClass(item: EquipmentItem) {
    if (item.conditionStatus === "OUT_OF_ORDER") return "border-red-500/60 bg-red-950/40 opacity-60";
    if (item.activeLoan) return "border-slate-600 bg-slate-800/80 opacity-70";
    if (item.conditionStatus === "MINOR_ISSUE") return "border-amber-500/50 bg-amber-950/30";
    if (selectedIds.includes(item.id)) return "border-emerald-400 bg-emerald-950/40";
    return "border-emerald-600/40 bg-slate-900/70";
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Borrow equipment</h1>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <p className="mb-2 text-sm text-slate-400">Member</p>
        {selectedMember ? (
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedMember.photoUrl}
              alt=""
              className="h-12 w-12 rounded-full object-cover bg-slate-800"
            />
            <p className="text-lg font-semibold">{selectedMember.fullName}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <input
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            placeholder="Search member"
            className="min-h-12 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3"
          />
          <button
            type="button"
            onClick={searchMembers}
            className="min-h-12 rounded-xl bg-slate-700 px-4 font-semibold"
          >
            Search
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {memberHits.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMemberId(m.id);
                setSelectedMember(m);
              }}
              className="min-h-12 rounded-xl bg-slate-800 px-3 font-medium"
            >
              {m.fullName}
            </button>
          ))}
        </div>
      </div>

      {grouped.map(([type, items]) => (
        <section key={type} className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-200">
            {type.replaceAll("_", " ")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item: EquipmentItem) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 ${statusClass(item)}`}
              >
                <button
                  type="button"
                  disabled={!item.available}
                  onClick={() => toggle(item.id, item.available)}
                  className="w-full text-left"
                >
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {item.activeLoan
                      ? `In use · ${item.activeLoan.member.fullName}`
                      : item.conditionStatus === "OUT_OF_ORDER"
                        ? "Out of order"
                        : item.conditionStatus === "MINOR_ISSUE"
                          ? "Minor issue · available"
                          : "Available"}
                  </p>
                </button>
                {item.activeLoan ? (
                  <button
                    type="button"
                    onClick={() => addToQueue(item.id)}
                    className="mt-3 min-h-12 w-full rounded-xl bg-slate-700 text-sm font-semibold"
                  >
                    Add to queue
                    {item.queueEntries.length
                      ? ` (${item.queueEntries.length})`
                      : ""}
                  </button>
                ) : null}
                {item.queueEntries.length > 0 ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Next: {item.queueEntries[0]?.member.fullName}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 rounded-2xl border border-slate-700 bg-slate-950/95 p-4 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">{selectedIds.length} item(s) selected</p>
          <button
            type="button"
            onClick={confirmBorrow}
            className="min-h-12 rounded-xl bg-emerald-600 px-6 font-semibold"
          >
            Confirm Borrow
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BorrowPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <BorrowInner />
    </Suspense>
  );
}
