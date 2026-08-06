"use client";

/**
 * Volunteer borrow desk: select a signed-in member, pick free equipment, or
 * join the wait queue. Items with a queue are reserved for the head until they
 * borrow; after return the next head is reserved, shortening the queue each time.
 * Member hits and the equipment catalog use scroll panels.
 * Members with open loans past their type time limit cannot borrow more until
 * those items are returned (enforced server-side; desk UI shows a banner).
 * Each equipment type has its own scroll panel; an outer panel scrolls through
 * all types so the full catalog stays on one manageable page.
 *
 * @author Muhammad Naheen Mahboob
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { dashboardFetch } from "@/lib/offline/sync";
import { useToast } from "@/components/ui/Toast";
import { ScrollPanel } from "@/components/ui/ScrollPanel";

type EquipmentItem = {
  id: string;
  label: string;
  type: string;
  conditionStatus: string;
  /** Free and no queue — anyone may borrow. */
  available: boolean;
  /** Free but queued — only this member may borrow next. */
  reservedFor: {
    memberId: string;
    fullName: string;
    queueLength: number;
  } | null;
  physicallyFree?: boolean;
  activeLoan: { member: { fullName: string } } | null;
  queueEntries: { id: string; member: { id: string; fullName: string } }[];
};

type MemberHit = { id: string; fullName: string; photoUrl: string };

/**
 * Active loan row used to detect past time-limit holds for the selected member.
 *
 * @author Muhammad Naheen Mahboob
 */
type ActiveLoanAlert = {
  id: string;
  alert: "ok" | "warning" | "overdue";
  equipment: { label: string };
};

function BorrowInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [memberId, setMemberId] = useState(searchParams.get("memberId") ?? "");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberHits, setMemberHits] = useState<MemberHit[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberHit | null>(null);
  /** Labels of this member's loans at/over their type time limit. */
  const [pastLimitLabels, setPastLimitLabels] = useState<string[]>([]);

  const loadEquipment = useCallback(async () => {
    const data = await apiFetch<{ equipment: EquipmentItem[] }>("/api/equipment");
    setEquipment(data.equipment);
  }, []);

  /**
   * Loads open loans for the selected member and records past-limit labels.
   *
   * @author Muhammad Naheen Mahboob
   */
  const refreshPastLimitLoans = useCallback(async (id: string) => {
    const data = await apiFetch<{ loans: ActiveLoanAlert[] }>(
      `/api/loans?memberId=${encodeURIComponent(id)}`
    );
    // warning = at/over limit; overdue = limit + 15 — both block new borrows.
    const blocked = data.loans
      .filter((l) => l.alert === "warning" || l.alert === "overdue")
      .map((l) => l.equipment.label);
    setPastLimitLabels(blocked);
  }, []);

  useEffect(() => {
    loadEquipment().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
  }, [loadEquipment, toast]);

  useEffect(() => {
    if (!memberId) {
      setPastLimitLabels([]);
      return;
    }
    apiFetch<{ member: MemberHit }>(`/api/members/${memberId}`)
      .then((d) => setSelectedMember(d.member))
      .catch(() => undefined);
    refreshPastLimitLoans(memberId).catch(() => setPastLimitLabels([]));
  }, [memberId, refreshPastLimitLoans]);

  const borrowBlocked = pastLimitLabels.length > 0;

  // Drop any in-progress selection once past-limit loans appear (or on member change).
  useEffect(() => {
    if (borrowBlocked) setSelectedIds([]);
  }, [borrowBlocked]);

  const grouped = useMemo(() => {
    const map = new Map<string, EquipmentItem[]>();
    for (const item of equipment) {
      const list = map.get(item.type) ?? [];
      list.push(item);
      map.set(item.type, list);
    }
    return Array.from(map.entries());
  }, [equipment]);

  /**
   * Whether the currently selected member may borrow this item right now.
   *
   * @param item - Equipment row from the catalog
   * @author Muhammad Naheen Mahboob
   */
  function canBorrow(item: EquipmentItem): boolean {
    // Past-limit open loans block any further checkout until returned.
    if (borrowBlocked) return false;
    if (item.activeLoan) return false;
    if (item.conditionStatus === "OUT_OF_ORDER") return false;
    if (item.available) return true;
    // Reserved: only the queue head may take it.
    return Boolean(
      item.reservedFor && memberId && item.reservedFor.memberId === memberId
    );
  }

  /**
   * Toggles an item in the borrow selection when the member may take it.
   *
   * @author Muhammad Naheen Mahboob
   */
  function toggle(id: string, item: EquipmentItem) {
    if (!canBorrow(item)) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  /**
   * Searches desk members for the borrower picker.
   * Blank query loads the full waiting + inside roster (no `q` param).
   *
   * @author Muhammad Naheen Mahboob
   */
  async function searchMembers() {
    const q = memberQuery.trim();
    const path = q
      ? `/api/members?q=${encodeURIComponent(q)}`
      : "/api/members";
    const data = await apiFetch<{ members: MemberHit[] }>(path);
    setMemberHits(data.members);
  }

  /**
   * Posts the selected equipment borrow; server re-checks past-limit loans.
   *
   * @author Muhammad Naheen Mahboob
   */
  async function confirmBorrow() {
    if (!memberId || selectedIds.length === 0) {
      toast.push("Select a member and at least one item", "warn");
      return;
    }
    if (borrowBlocked) {
      toast.push(
        `Return overdue equipment first: ${pastLimitLabels.join(", ")}`,
        "error"
      );
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
      await refreshPastLimitLoans(memberId);
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
    if (item.conditionStatus === "OUT_OF_ORDER") {
      return "border-red-500/60 bg-red-950/40 opacity-60";
    }
    if (item.activeLoan) return "border-slate-600 bg-slate-800/80 opacity-70";
    if (item.reservedFor) {
      if (canBorrow(item)) return "border-amber-400 bg-amber-950/40";
      return "border-amber-500/40 bg-amber-950/20 opacity-80";
    }
    if (item.conditionStatus === "MINOR_ISSUE") {
      return "border-amber-500/50 bg-amber-950/30";
    }
    if (selectedIds.includes(item.id)) return "border-emerald-400 bg-emerald-950/40";
    return "border-emerald-600/40 bg-slate-900/70";
  }

  function statusText(item: EquipmentItem) {
    if (item.activeLoan) return `In use · ${item.activeLoan.member.fullName}`;
    if (item.conditionStatus === "OUT_OF_ORDER") return "Out of order";
    if (item.reservedFor) {
      return `Reserved for ${item.reservedFor.fullName} · queue ${item.reservedFor.queueLength}`;
    }
    if (item.conditionStatus === "MINOR_ISSUE") return "Minor issue · available";
    return "Available";
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Borrow equipment</h1>
        <p className="text-sm text-slate-400">
          When someone is waiting, a returned item stays reserved for the next
          person in line until they borrow it — then the queue moves forward.
        </p>
      </div>

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
        {borrowBlocked ? (
          <div className="mb-3 rounded-xl border border-amber-500/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
            <p className="font-semibold">Borrowing blocked — return overdue items first</p>
            <p className="mt-1 text-amber-200/90">
              {pastLimitLabels.join(", ")}
            </p>
            <Link
              href={`/dashboard/return?memberId=${encodeURIComponent(memberId)}`}
              className="mt-2 inline-flex min-h-10 items-center rounded-lg bg-amber-500 px-3 text-sm font-semibold text-slate-950"
            >
              Open return
            </Link>
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
        <div className="mt-2">
          {memberHits.length > 0 ? (
            <ScrollPanel label="Member search results" density="rows">
              <div className="flex flex-wrap gap-2">
                {memberHits.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMemberId(m.id);
                      setSelectedMember(m);
                      // Changing borrower invalidates selections that may be reserved for someone else.
                      setSelectedIds([]);
                    }}
                    className="min-h-12 rounded-xl bg-slate-800 px-3 font-medium"
                  >
                    {m.fullName}
                  </button>
                ))}
              </div>
            </ScrollPanel>
          ) : null}
        </div>
      </div>

      {/* Outer: scroll through equipment types; inner: scroll items within a type. */}
      <ScrollPanel label="Equipment types catalog">
        <div className="space-y-5">
          {grouped.map(([type, items]) => (
            <section key={type} className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-200">
                {type.replaceAll("_", " ")}
              </h2>
              <ScrollPanel
                label={`${type.replaceAll("_", " ")} equipment`}
                density="section"
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item: EquipmentItem) => {
                    const borrowable = canBorrow(item);
                    const showQueueButton =
                      Boolean(item.activeLoan) || Boolean(item.reservedFor);
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-4 ${statusClass(item)}`}
                      >
                        <button
                          type="button"
                          disabled={!borrowable}
                          onClick={() => toggle(item.id, item)}
                          className="w-full text-left disabled:cursor-not-allowed"
                        >
                          <p className="font-semibold">{item.label}</p>
                          <p className="mt-1 text-sm text-slate-300">
                            {statusText(item)}
                          </p>
                          {item.reservedFor &&
                          memberId &&
                          item.reservedFor.memberId === memberId ? (
                            <p className="mt-1 text-xs font-semibold text-amber-200">
                              This member is next — tap to select
                            </p>
                          ) : null}
                        </button>
                        {showQueueButton ? (
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
                          <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-xs text-slate-400">
                            {item.queueEntries.map((entry, index) => (
                              <li key={entry.id}>
                                {index === 0 ? "Next: " : ""}
                                {entry.member.fullName}
                              </li>
                            ))}
                          </ol>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </ScrollPanel>
            </section>
          ))}
        </div>
      </ScrollPanel>

      <div className="sticky bottom-4 rounded-2xl border border-slate-700 bg-slate-950/95 p-4 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">{selectedIds.length} item(s) selected</p>
          <button
            type="button"
            onClick={confirmBorrow}
            disabled={borrowBlocked || selectedIds.length === 0}
            className="min-h-12 rounded-xl bg-emerald-600 px-6 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
