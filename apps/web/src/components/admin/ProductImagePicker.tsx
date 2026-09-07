"use client";

/**
 * Product image picker
 * --------------------
 * Pick a photo, compress large phone images in-browser, then upload.
 */

import { useRef, useState } from "react";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { compressProductImage } from "@/lib/compress-image";
import { api } from "@/lib/api";

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
      const prepared = await compressProductImage(file);
      const body = new FormData();
      body.append("image", prepared);

      const data = await api<{ url: string }>("/api/admin/upload", {
        method: "POST",
        body,
        retries: 1,
      });
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
            Large phone photos are compressed automatically before upload (JPEG / PNG / WebP).
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
