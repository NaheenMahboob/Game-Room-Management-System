"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type Announcement = {
  id: string;
  title: string;
  content: string;
  targetAudience: string;
};
type EventItem = {
  id: string;
  title: string;
  description: string;
  eventDate: string;
};

export default function AdminContentPage() {
  const toast = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [aForm, setAForm] = useState({
    title: "",
    content: "",
    targetAudience: "GENERAL",
  });
  const [eForm, setEForm] = useState({
    title: "",
    description: "",
    eventDate: "",
  });

  async function refresh() {
    const [a, e] = await Promise.all([
      apiFetch<{ announcements: Announcement[] }>("/api/admin/announcements"),
      apiFetch<{ events: EventItem[] }>("/api/admin/events"),
    ]);
    setAnnouncements(a.announcements);
    setEvents(e.events);
  }

  useEffect(() => {
    refresh().catch((err) =>
      toast.push(err instanceof Error ? err.message : "Load failed", "error")
    );
  }, [toast]);

  async function createAnnouncement(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify(aForm),
      });
      setAForm({ title: "", content: "", targetAudience: "GENERAL" });
      toast.push("Announcement created");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function createEvent(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/api/admin/events", {
        method: "POST",
        body: JSON.stringify(eForm),
      });
      setEForm({ title: "", description: "", eventDate: "" });
      toast.push("Event created");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Announcements</h2>
        <form
          onSubmit={createAnnouncement}
          className="space-y-2 rounded-2xl border border-slate-700 bg-slate-900/60 p-4"
        >
          <input
            required
            value={aForm.title}
            onChange={(e) => setAForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title"
            className="min-h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3"
          />
          <textarea
            required
            value={aForm.content}
            onChange={(e) =>
              setAForm((f) => ({ ...f, content: e.target.value }))
            }
            placeholder="Content"
            className="min-h-24 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2"
          />
          <select
            value={aForm.targetAudience}
            onChange={(e) =>
              setAForm((f) => ({ ...f, targetAudience: e.target.value }))
            }
            className="min-h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3"
          >
            <option value="GENERAL">GENERAL</option>
            <option value="MEMBERS">MEMBERS</option>
            <option value="VOLUNTEERS">VOLUNTEERS</option>
          </select>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-amber-500 px-4 font-semibold text-slate-950"
          >
            Publish
          </button>
        </form>
        <ul className="space-y-2">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-slate-700 bg-slate-900/50 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-sm text-slate-400">{a.targetAudience}</p>
                  <p className="mt-1 text-sm">{a.content}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/admin/announcements?id=${a.id}`, {
                      method: "DELETE",
                    });
                    await refresh();
                  }}
                  className="text-xs text-red-300"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Events</h2>
        <form
          onSubmit={createEvent}
          className="space-y-2 rounded-2xl border border-slate-700 bg-slate-900/60 p-4"
        >
          <input
            required
            value={eForm.title}
            onChange={(e) => setEForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title"
            className="min-h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3"
          />
          <textarea
            required
            value={eForm.description}
            onChange={(e) =>
              setEForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Description"
            className="min-h-24 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2"
          />
          <input
            required
            type="datetime-local"
            value={eForm.eventDate}
            onChange={(e) =>
              setEForm((f) => ({ ...f, eventDate: e.target.value }))
            }
            className="min-h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3"
          />
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-amber-500 px-4 font-semibold text-slate-950"
          >
            Create event
          </button>
        </form>
        <ul className="space-y-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-slate-700 bg-slate-900/50 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{event.title}</p>
                  <p className="text-sm text-amber-200">
                    {new Date(event.eventDate).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm">{event.description}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/admin/events?id=${event.id}`, {
                      method: "DELETE",
                    });
                    await refresh();
                  }}
                  className="text-xs text-red-300"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
