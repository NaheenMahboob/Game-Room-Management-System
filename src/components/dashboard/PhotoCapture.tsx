"use client";

/**
 * Webcam / file picker used during registration and photo retake flows.
 * Emits a local `data:` URL preview; callers upload via
 * {@link uploadMemberPhotoDataUrl} before persisting a member record.
 * Supports clearing the preview with an X so the user can re-capture.
 */

import { useEffect, useRef, useState } from "react";

type PhotoCaptureProps = {
  /** Current preview (`data:` URL / API path) or `null` when empty. */
  value: string | null;
  /** Called with a JPEG/PNG data URL after capture/file select, or `null` on clear. */
  onChange: (dataUrl: string | null) => void;
};

/**
 * Tablet-friendly photo capture control with camera, file upload, and clear.
 *
 * @param props - Controlled preview value and change handler
 */
export function PhotoCapture({ value, onChange }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  /** Live MediaStream — stopped on capture, clear, unmount, or cancel. */
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /** Stops any live camera tracks. */
  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }

  /**
   * Clears the preview so the user can capture or upload again.
   */
  function clearPhoto() {
    stopStream();
    onChange(null);
    setError(null);
  }

  /**
   * Requests front-facing camera access and starts the preview video.
   */
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

  /**
   * Snapshots the current video frame to a JPEG data URL and stops the stream.
   */
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
    stopStream();
  }

  /**
   * Reads a picked image file into a data URL for the same preview path.
   *
   * @param file - Selected image, or `null` if the picker was cancelled
   */
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
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Member preview"
            className="h-40 w-40 rounded-xl object-cover"
          />
          <button
            type="button"
            onClick={clearPhoto}
            aria-label="Remove photo"
            className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white shadow-lg hover:bg-red-500"
          >
            ×
          </button>
        </div>
      ) : null}
      {streaming ? (
        <video
          ref={videoRef}
          className="h-48 w-full rounded-xl bg-black object-cover"
          muted
          playsInline
        />
      ) : null}
      {!value ? (
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
      ) : (
        <p className="text-sm text-slate-400">
          Photo ready — remove with × to choose a different one.
        </p>
      )}
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
    </div>
  );
}
