"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type Announcement = {
  id: string;
  title: string;
  content: string;
  targetAudience: string;
  createdAt: string;
};

export default function PortalAnnouncementsPage() {
  const toast = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    apiFetch<{ announcements: Announcement[] }>("/api/portal/announcements")
      .then((data) => setAnnouncements(data.announcements))
      .catch((err) =>
        toast.push(err instanceof Error ? err.message : "Load failed", "error")
      );
  }, [toast]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Announcements</h1>
      {announcements.length === 0 ? (
        <p className="text-slate-400">No announcements.</p>
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{a.title}</h2>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  {a.targetAudience}
                </span>
              </div>
              <p className="text-slate-300">{a.content}</p>
              <p className="mt-2 text-xs text-slate-500">
                {new Date(a.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
