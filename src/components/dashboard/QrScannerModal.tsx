"use client";

import { useEffect, useRef, useState } from "react";

type QrScannerModalProps = {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
};

export function QrScannerModal({ open, onClose, onScan }: QrScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<InstanceType<
    typeof import("html5-qrcode").Html5Qrcode
  > | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      try {
        setError(null);
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (cancelled) return;
            onScan(decoded.trim());
            onClose();
          },
          () => undefined
        );
        started.current = true;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to start camera for QR scanning"
        );
      }
    }

    start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner && started.current) {
        scanner
          .stop()
          .then(() => {
            scanner.clear();
          })
          .catch(() => undefined);
      }
      started.current = false;
    };
  }, [open, onClose, onScan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Scan member QR</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-xl bg-slate-800 px-4 font-semibold"
          >
            Close
          </button>
        </div>
        {error ? (
          <p className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : (
          <div id="qr-reader" className="overflow-hidden rounded-xl" />
        )}
      </div>
    </div>
  );
}
