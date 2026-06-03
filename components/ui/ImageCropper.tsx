"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";

interface ImageCropperProps {
  imageSrc: string;
  onCropDone: (croppedBlob: Blob, croppedUrl: string) => void;
  onCancel: () => void;
  aspectRatio?: number; // default 1 (square), pass 16/9, 4/3, etc.
}

const CANVAS_SIZE   = 400;
const HANDLE_RADIUS = 14;
const MIN_SIZE      = 40;

type Mode = "move" | "pan" | "resize";
type Handle = "tl" | "tr" | "bl" | "br";

function ratioLabel(r: number) {
  if (Math.abs(r - 1) < 0.01)     return "1 : 1";
  if (Math.abs(r - 16 / 9) < 0.01) return "16 : 9";
  if (Math.abs(r - 4 / 3) < 0.01)  return "4 : 3";
  if (Math.abs(r - 3 / 2) < 0.01)  return "3 : 2";
  return "custom";
}

export function ImageCropper({ imageSrc, onCropDone, onCancel, aspectRatio = 1 }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);

  // Image transform state
  const scale  = useRef(1);
  const offset = useRef({ x: 0, y: 0 }); // image top-left on canvas

  // Crop box state (canvas coords)
  const crop = useRef({ x: 80, y: 80, w: 240, h: 240 });

  // Interaction state
  const ia = useRef<{ mode: Mode; handle?: Handle; startX: number; startY: number; startCrop: typeof crop.current; startOffset: typeof offset.current } | null>(null);

  const [cursor, setCursor] = useState("default");
  const [ready, setReady]   = useState(false);
  const [visible, setVisible] = useState(false);

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Image
    const { x, y } = offset.current;
    const w = img.naturalWidth  * scale.current;
    const h = img.naturalHeight * scale.current;
    ctx.drawImage(img, x, y, w, h);

    // Dim outside crop
    const { x: cx, y: cy, w: cw, h: ch } = crop.current;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, CANVAS_SIZE, cy);
    ctx.fillRect(0, cy, cx, ch);
    ctx.fillRect(cx + cw, cy, CANVAS_SIZE - cx - cw, ch);
    ctx.fillRect(0, cy + ch, CANVAS_SIZE, CANVAS_SIZE - cy - ch);

    // Crop border
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx, cy, cw, ch);

    // Rule-of-thirds grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 0.8;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(cx + cw * i / 3, cy); ctx.lineTo(cx + cw * i / 3, cy + ch); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + ch * i / 3); ctx.lineTo(cx + cw, cy + ch * i / 3); ctx.stroke();
    }

    // Corner handles
    const handles: [Handle, number, number][] = [
      ["tl", cx, cy], ["tr", cx + cw, cy],
      ["bl", cx, cy + ch], ["br", cx + cw, cy + ch],
    ];
    handles.forEach(([, hx, hy]) => {
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }, []);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Fit image inside canvas
      const scaleW = CANVAS_SIZE / img.naturalWidth;
      const scaleH = CANVAS_SIZE / img.naturalHeight;
      scale.current = Math.min(scaleW, scaleH) * 0.9;
      const w = img.naturalWidth  * scale.current;
      const h = img.naturalHeight * scale.current;
      offset.current = { x: (CANVAS_SIZE - w) / 2, y: (CANVAS_SIZE - h) / 2 };

      // Initial crop box: 60% of the smaller dimension, centered, respecting aspectRatio
      const maxSide = Math.min(w, h) * 0.6;
      const cw = aspectRatio >= 1 ? maxSide : maxSide * aspectRatio;
      const ch = aspectRatio >= 1 ? maxSide / aspectRatio : maxSide;
      crop.current = {
        x: (CANVAS_SIZE - cw) / 2,
        y: (CANVAS_SIZE - ch) / 2,
        w: cw,
        h: ch,
      };
      setReady(true);
      draw();
    };
    img.src = imageSrc;
  }, [imageSrc, aspectRatio, draw]);

  useEffect(() => { if (ready) draw(); }, [ready, draw]);

  // Hit-test helpers
  const hitHandle = (mx: number, my: number): Handle | null => {
    const { x: cx, y: cy, w: cw, h: ch } = crop.current;
    const pts: [Handle, number, number][] = [
      ["tl", cx, cy], ["tr", cx + cw, cy],
      ["bl", cx, cy + ch], ["br", cx + cw, cy + ch],
    ];
    for (const [h, hx, hy] of pts) {
      if (Math.hypot(mx - hx, my - hy) <= HANDLE_RADIUS) return h;
    }
    return null;
  };
  const hitCrop = (mx: number, my: number) => {
    const { x: cx, y: cy, w: cw, h: ch } = crop.current;
    return mx >= cx && mx <= cx + cw && my >= cy && my <= cy + ch;
  };

  const pos = (e: React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const { x, y } = pos(e);
    const handle = hitHandle(x, y);
    if (handle) {
      ia.current = { mode: "resize", handle, startX: x, startY: y, startCrop: { ...crop.current }, startOffset: { ...offset.current } };
    } else if (hitCrop(x, y)) {
      ia.current = { mode: "move", startX: x, startY: y, startCrop: { ...crop.current }, startOffset: { ...offset.current } };
    } else {
      ia.current = { mode: "pan", startX: x, startY: y, startCrop: { ...crop.current }, startOffset: { ...offset.current } };
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const { x, y } = pos(e);
    if (!ia.current) {
      const h = hitHandle(x, y);
      if (h) {
        setCursor(h === "tl" || h === "br" ? "nwse-resize" : "nesw-resize");
      } else if (hitCrop(x, y)) {
        setCursor("move");
      } else {
        setCursor("grab");
      }
      return;
    }

    const dx = x - ia.current.startX;
    const dy = y - ia.current.startY;

    if (ia.current.mode === "pan") {
      offset.current = { x: ia.current.startOffset.x + dx, y: ia.current.startOffset.y + dy };
    } else if (ia.current.mode === "move") {
      const { x: sx, y: sy, w: sw, h: sh } = ia.current.startCrop;
      crop.current = {
        x: Math.max(0, Math.min(CANVAS_SIZE - sw, sx + dx)),
        y: Math.max(0, Math.min(CANVAS_SIZE - sh, sy + dy)),
        w: sw, h: sh,
      };
    } else if (ia.current.mode === "resize" && ia.current.handle) {
      const { x: sx, y: sy, w: sw, h: sh } = ia.current.startCrop;
      let nx = crop.current.x, ny = crop.current.y, nw = crop.current.w, nh = crop.current.h;

      if (ia.current.handle === "br") {
        nw = Math.max(MIN_SIZE, sw + dx);
        nh = nw / aspectRatio;
      } else if (ia.current.handle === "tl") {
        nw = Math.max(MIN_SIZE, sw - dx);
        nh = nw / aspectRatio;
        nx = sx + sw - nw;
        ny = sy + sh - nh;
      } else if (ia.current.handle === "tr") {
        nw = Math.max(MIN_SIZE, sw + dx);
        nh = nw / aspectRatio;
        ny = sy + sh - nh;
      } else if (ia.current.handle === "bl") {
        nw = Math.max(MIN_SIZE, sw - dx);
        nh = nw / aspectRatio;
        nx = sx + sw - nw;
      }
      crop.current = { x: nx, y: ny, w: nw, h: nh };
    }
    draw();
  };

  const onMouseUp = () => { ia.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.08 : 0.93;
    scale.current = Math.max(0.1, scale.current * delta);
    draw();
  };

  const applyCrop = () => {
    const img = imgRef.current;
    if (!img) return;
    const { x: cx, y: cy, w: cw, h: ch } = crop.current;
    // Map crop box back to image natural coords
    const sx = (cx - offset.current.x) / scale.current;
    const sy = (cy - offset.current.y) / scale.current;
    const sw = cw / scale.current;
    const sh = ch / scale.current;

    const out = document.createElement("canvas");
    out.width  = 512;
    out.height = Math.round(512 / aspectRatio);
    const ctx = out.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      onCropDone(blob, url);
    }, "image/jpeg", 0.92);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ backgroundColor: visible ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)", transition: "background-color 220ms ease" }}
    >
      <div
        className="bg-white dark:bg-[#0c0e16] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 560, opacity: visible ? 1 : 0, transform: visible ? "scale(1)" : "scale(0.96)", transition: "opacity 220ms ease, transform 220ms ease" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
          <span className="text-sm font-semibold text-slate-800 dark:text-white">Crop Image</span>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/8 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-500 dark:text-white/50 transition"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Canvas */}
        <div className="bg-slate-100 dark:bg-[#06070a] w-full flex justify-center py-5">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="rounded"
            style={{ display: "block", width: CANVAS_SIZE, height: CANVAS_SIZE, cursor }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
          />
        </div>

        {/* Hint */}
        <p className="text-[10px] font-mono text-slate-400 dark:text-white/30 text-center py-2 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 px-10">
          Scroll to zoom · Drag corners to resize ({ratioLabel(aspectRatio)}) · Drag image to pan
        </p>

        {/* Actions */}
        <div className="flex gap-2 px-10 py-3 border-t border-slate-100 dark:border-white/5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-white/60 bg-slate-100 dark:bg-white/8 hover:bg-slate-200 dark:hover:bg-white/15 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={applyCrop}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-[#2D6CFA] hover:bg-[#255DE6] active:bg-[#1e50c8] transition"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImageCropper;
