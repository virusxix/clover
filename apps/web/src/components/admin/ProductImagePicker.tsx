"use client";

/**
 * Product image picker
 * --------------------
 * One job: pick a photo from the device library / camera and upload it.
 * Accepts every image/* type (JPEG, PNG, HEIC, WebP, GIF, …).
 */

import { useRef, useState } from "react";
import { CatalogImage } from "@/components/ui/CatalogImage";

type Props = {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export function ProductImagePicker({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pick = () => inputRef.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("image", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : `Upload failed (${res.status})`
        );
      }
      onChange(String(data.url));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-xs font-bold tracking-widest uppercase text-soul-muted block">
        Product photo
      </label>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="relative w-28 h-36 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-black/5">
          {value ? (
            <CatalogImage src={value} alt="Product preview" fill className="object-cover" sizes="112px" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-soul-muted px-2 text-center">
              No photo
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            // Lets mobile open the photo library / camera roll
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={pick}
            disabled={disabled || uploading}
            className="btn-soul--dark rounded-full px-5 py-3 text-xs font-bold tracking-widest uppercase min-h-[48px] disabled:opacity-50"
          >
            {uploading ? "Uploading…" : value ? "Change photo" : "Choose from library"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled || uploading}
              className="block text-xs font-semibold text-soul-muted hover:text-black min-h-[36px]"
            >
              Remove photo
            </button>
          )}
          <p className="text-[11px] text-soul-muted leading-relaxed">
            Any image type from your phone or computer (JPEG, PNG, HEIC, WebP, GIF, …). Max 15&nbsp;MB.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
