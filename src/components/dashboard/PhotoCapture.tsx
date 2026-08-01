"use client";

import { useEffect, useRef, useState } from "react";

type PhotoCaptureProps = {
  value: string | null;
  onChange: (dataUrl: string) => void;
};

export function PhotoCapture({ value, onChange }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startCamera() {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setError("Camera unavailable — use file upload instead.");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL("image/jpeg", 0.85));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStreaming(false);
  }

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <p className="text-sm font-semibold text-slate-200">Profile photo *</p>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Member preview"
          className="h-40 w-40 rounded-xl object-cover"
        />
      ) : null}
      {streaming ? (
        <video
          ref={videoRef}
          className="h-48 w-full rounded-xl bg-black object-cover"
          muted
          playsInline
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!streaming ? (
          <button
            type="button"
            onClick={startCamera}
            className="min-h-12 rounded-xl bg-slate-700 px-4 font-semibold"
          >
            Open camera
          </button>
        ) : (
          <button
            type="button"
            onClick={capture}
            className="min-h-12 rounded-xl bg-emerald-600 px-4 font-semibold"
          >
            Capture photo
          </button>
        )}
        <label className="min-h-12 cursor-pointer rounded-xl bg-slate-700 px-4 py-3 font-semibold">
          Upload file
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
    </div>
  );
}
