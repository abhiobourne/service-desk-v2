"use client";

import React, { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { UploadCloud, FileText, X } from "lucide-react";
import { ImageCropper } from "./ImageCropper";

interface FileEntry {
  file: File;
  previewUrl: string | null; // object URL for images (possibly post-crop)
}

interface MultiFileUploadProps {
  value: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  acceptLabel?: string;
  maxFiles?: number;
  cropImages?: boolean;    // show cropper when an image is selected
  aspectRatio?: number;    // for cropper, default 1
  className?: string;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MultiFileUpload({
  value,
  onChange,
  accept = "image/*,application/pdf",
  acceptLabel = "PNG, JPG, GIF or PDF",
  maxFiles = Infinity,
  cropImages = true,
  aspectRatio = 1,
  className = "",
}: MultiFileUploadProps) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Pending crop state
  const [cropSrc, setCropSrc]           = useState<string | null>(null);
  const [pendingFile, setPendingFile]   = useState<File | null>(null);

  const entries: FileEntry[] = value.map(f => ({
    file: f,
    previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
  }));

  const atLimit = value.length >= maxFiles;

  const addFiles = useCallback((incoming: File[]) => {
    const first = incoming[0];
    if (!first) return;

    // If cropping is enabled and it's an image, open the cropper for the first file
    if (cropImages && first.type.startsWith("image/")) {
      const url = URL.createObjectURL(first);
      setCropSrc(url);
      setPendingFile(first);
      // Queue remaining files to add after crop (without cropping)
      if (incoming.length > 1) {
        const rest = incoming.slice(1);
        onChange([...value, ...rest]);
      }
      return;
    }

    const allowed = maxFiles === Infinity ? incoming : incoming.slice(0, maxFiles - value.length);
    onChange([...value, ...allowed]);
  }, [value, onChange, cropImages, maxFiles]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) addFiles(files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  };

  const removeAt = (i: number) => {
    const next = value.filter((_, j) => j !== i);
    onChange(next);
  };

  const onCropDone = (blob: Blob, croppedUrl: string) => {
    if (!pendingFile) return;
    const cropped = new File([blob], pendingFile.name, { type: blob.type });
    onChange([...value, cropped]);
    URL.revokeObjectURL(cropSrc!);
    setCropSrc(null);
    setPendingFile(null);
  };

  const onCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setPendingFile(null);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Drop zone */}
      {!atLimit && (
        <label
          className={`flex w-full min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 outline-none
            ${dragging
              ? "border-[#2D6CFA] bg-blue-50 dark:bg-blue-500/10 scale-[1.01]"
              : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] hover:border-blue-300 dark:hover:border-blue-500/40 hover:bg-blue-50/50 dark:hover:bg-blue-500/5"
            }`}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
        >
          <div className="flex flex-col items-center justify-center gap-2 py-6 pointer-events-none">
            <UploadCloud className={`w-8 h-8 ${dragging ? "text-[#2D6CFA]" : "text-slate-300 dark:text-white/20"}`} />
            <p className="text-xs font-mono text-slate-500 dark:text-white/40">
              {dragging
                ? <span className="font-semibold text-[#2D6CFA]">Drop files here</span>
                : <><span className="font-semibold text-slate-600 dark:text-white/60">Click to upload</span> or drag and drop</>
              }
            </p>
            <p className="text-[10px] font-mono text-slate-400 dark:text-white/25">{acceptLabel}</p>
            {maxFiles !== Infinity && (
              <p className="text-[10px] font-mono text-slate-300 dark:text-white/15">{value.length} / {maxFiles} files</p>
            )}
          </div>
          <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={onInputChange} />
        </label>
      )}

      {/* File list */}
      {entries.length > 0 && (
        <ul className="space-y-2">
          {entries.map((entry, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] px-3 py-2 shadow-sm">
              {entry.previewUrl ? (
                <img src={entry.previewUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0 border border-slate-100 dark:border-white/5" />
              ) : (
                <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/8">
                  <FileText className="w-4.5 h-4.5 text-blue-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 dark:text-white/70 truncate">{entry.file.name}</p>
                <p className="text-[10px] font-mono text-slate-400 dark:text-white/25">{formatBytes(entry.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="shrink-0 p-1 rounded-full text-slate-300 dark:text-white/20 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {atLimit && maxFiles !== Infinity && (
        <p className="text-[10px] font-mono text-slate-400 dark:text-white/25 text-center">Maximum of {maxFiles} files reached.</p>
      )}

      {/* Image cropper — rendered in a portal so it's outside any <form> */}
      {cropSrc && typeof document !== "undefined" && createPortal(
        <ImageCropper
          imageSrc={cropSrc}
          aspectRatio={aspectRatio}
          onCropDone={onCropDone}
          onCancel={onCropCancel}
        />,
        document.body,
      )}
    </div>
  );
}

export default MultiFileUpload;
