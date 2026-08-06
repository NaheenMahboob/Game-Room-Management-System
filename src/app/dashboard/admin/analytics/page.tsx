"use client";

/**
 * Admin analytics charts and ranked equipment popularity.
 * Popular-equipment ranking uses a scroll panel when many items appear.
 *
 * @author Muhammad Naheen Mahboob
 */

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { ScrollPanel } from "@/components/ui/ScrollPanel";

type Analytics = {
  totals: {
    visitsLast7Days: number;
    visitsLast30Days: number;
    newMembersLast30Days: number;
    totalMembers: number;
    averageVisitMinutes: number;
    communityHoursServedLast30Days: number;
  };
  dailyVisits: { date: string; count: number }[];
  hourCounts: { hour: number; count: number }[];
  dowCounts: { day: number; count: number }[];
  popularEquipment: { label: string; type: string; count: number }[];
  registrationsByMonth: { month: string; count: number }[];
  equipmentCondition: { status: string; count: number }[];
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminAnalyticsPage() {
  const toast = useToast();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    apiFetch<{ analytics: Analytics }>("/api/admin/analytics")
      .then((d) => setAnalytics(d.analytics))
      .catch((err) =>
        toast.push(err instanceof Error ? err.message : "Load failed", "error")
      );
  }, [toast]);

  if (!analytics) return <p className="text-slate-400">Loading analytics…</p>;

  const t = analytics.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Analytics</h2>
        <div className="flex flex-wrap gap-2">
          {["visits", "equipment", "members", "audit"].map((type) => (
            <a
              key={type}
              href={`/api/admin/reports/csv?type=${type}`}
              className="min-h-11 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold capitalize hover:bg-slate-700"
            >
              Export {type} CSV
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Visits (7d)", t.visitsLast7Days],
          ["Visits (30d)", t.visitsLast30Days],
          ["New members (30d)", t.newMembersLast30Days],
          ["Total members", t.totalMembers],
          ["Avg visit (min)", t.averageVisitMinutes],
          ["Community hours (30d)", t.communityHoursServedLast30Days],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4"
          >
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-bold text-amber-300">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="mb-3 font-semibold">Daily visits (14 days)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.dailyVisits}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="mb-3 font-semibold">Busiest hours</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.hourCounts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hour" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#14b8a6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="mb-3 font-semibold">Busiest days</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.dowCounts.map((d) => ({
                  ...d,
                  label: DOW[d.day],
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="mb-3 font-semibold">Most popular equipment</h3>
          <ScrollPanel label="Popular equipment ranking" density="rows">
            <ul className="space-y-2">
              {analytics.popularEquipment.map((item, i) => (
                <li
                  key={item.label}
                  className="flex justify-between rounded-xl bg-slate-950/50 px-3 py-2 text-sm"
                >
                  <span>
                    {i + 1}. {item.label}
                  </span>
                  <span className="font-mono text-amber-300">{item.count}</span>
                </li>
              ))}
            </ul>
          </ScrollPanel>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="mb-3 font-semibold">Registrations by month</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.registrationsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#34d399" name="New members" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {analytics.equipmentCondition.map((c) => (
              <span
                key={c.status}
                className="rounded-full bg-slate-800 px-3 py-1"
              >
                {c.status}: {c.count}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
