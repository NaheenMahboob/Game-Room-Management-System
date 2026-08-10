"use client";

/**
 * Canvas + optional typed-name signature capture for waiver PDFs.
 * Uses dark ink on a white pad so the stamped PNG is readable on paper-like PDFs.
 *
 * @author Muhammad Naheen Mahboob
 */

import { useRef, useState } from "react";

type SignaturePadProps = {
  onChange: (value: string) => void;
};

export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [typed, setTyped] = useState("");

  function fillWhite() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // First stroke: ensure opaque white background for PDF embedding.
    const sample = ctx.getImageData(0, 0, 1, 1).data;
    if (sample[3] === 0) fillWhite();
    const { x, y } = getPos(e);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setTyped("");
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fillWhite();
    setTyped("");
    onChange("");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <p className="text-sm font-semibold">Digital waiver signature *</p>
      <canvas
        ref={canvasRef}
        width={600}
        height={180}
        className="h-40 w-full touch-none rounded-xl border border-slate-600 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clear}
          className="min-h-12 rounded-xl bg-slate-700 px-4 font-semibold"
        >
          Clear
        </button>
      </div>
      <label className="block space-y-1">
        <span className="text-sm text-slate-400">Or type full legal name</span>
        <input
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            onChange(e.target.value.trim());
          }}
          className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-3"
          placeholder="Typed legal name"
        />
      </label>
    </div>
  );
}
