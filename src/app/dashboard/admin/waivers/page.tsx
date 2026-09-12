"use client";

/**
 * Admin UI to preview and upload versioned waiver template PDFs.
 *
 * @author Muhammad Naheen Mahboob
 */

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

type WaiverRow = {
  id: string;
  version: number;
  templatePdfUrl: string | null;
  createdAt: string;
};

export default function AdminWaiversPage() {
  const toast = useToast();
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [waivers, setWaivers] = useState<WaiverRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [versionOverride, setVersionOverride] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{
        currentVersion: number;
        pdfSrc: string;
        waivers: WaiverRow[];
      }>("/api/admin/waivers");
      setCurrentVersion(data.currentVersion);
      setPdfSrc(data.pdfSrc);
      setWaivers(data.waivers);
      setPreviewKey((k) => k + 1);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Load failed", "error");
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload() {
    if (!file) {
      toast.push("Choose a PDF file first", "error");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (versionOverride.trim()) {
        form.append("version", versionOverride.trim());
      }
      const res = await fetch("/api/admin/waivers", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = (await res.json()) as {
        error?: string;
        currentVersion?: number;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }
      toast.push(
        `Waiver version ${data.currentVersion ?? ""} published. Members on older versions must re-sign.`
      );
      setFile(null);
      setVersionOverride("");
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Waiver templates</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Edit the legal text in Word or Acrobat, export a PDF, then upload it
          here. Publishing a new version updates registration and requires
          members still on an older version to re-sign before check-in.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Current template</h3>
          {currentVersion != null ? (
            <span className="text-sm text-amber-200">
              Active version {currentVersion}
            </span>
          ) : null}
        </div>
        {pdfSrc ? (
          <div className="mt-3 space-y-2">
            <iframe
              key={previewKey}
              title="Current waiver template"
              src={`${pdfSrc}?t=${previewKey}`}
              className="h-96 w-full rounded-xl border border-slate-700 bg-slate-950"
            />
            <a
              href={pdfSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-emerald-400 hover:text-emerald-300"
            >
              Open full PDF
            </a>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">No template loaded yet.</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
        <h3 className="font-semibold">Upload new version</h3>
        <label className="block space-y-1 text-sm">
          <span className="text-slate-300">PDF file</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:font-semibold file:text-slate-100"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-slate-300">
            Version number (optional — leave blank to auto-increment)
          </span>
          <input
            type="number"
            min={1}
            value={versionOverride}
            onChange={(e) => setVersionOverride(e.target.value)}
            placeholder="e.g. 3"
            className="w-full max-w-xs rounded-xl border border-slate-600 bg-slate-950 px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={uploading || !file}
          onClick={() => void upload()}
          className="min-h-11 rounded-xl bg-amber-500 px-4 font-semibold text-slate-950 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Publish PDF"}
        </button>
        <p className="text-xs text-slate-500">
          IT alternative: place{" "}
          <code className="text-slate-400">template-vN.pdf</code> under{" "}
          <code className="text-slate-400">storage/waivers/templates/</code> and
          set <code className="text-slate-400">waiverVersion</code> in Settings
          (and ensure a matching <code className="text-slate-400">Waiver</code>{" "}
          row exists).
        </p>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="font-semibold">Version history</h3>
        {waivers.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No waiver rows yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800 text-sm">
            {waivers.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  Version {w.version}
                  {w.version === currentVersion ? (
                    <span className="ml-2 text-amber-300">(active)</span>
                  ) : null}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {w.templatePdfUrl ?? "(no file)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
