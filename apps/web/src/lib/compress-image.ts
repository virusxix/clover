/**
 * Compress a product photo in the browser before upload.
 * Phone cameras often produce 15–40MB files; Vercel’s proxy and multer cannot take those raw.
 */

const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.82;
/** Stay under Vercel serverless body limits with headroom. */
const TARGET_MAX_BYTES = 3.5 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "Could not read this image. Try JPEG or PNG (HEIC may need conversion on this device)."
        )
      );
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image compression failed"))),
      type,
      quality
    );
  });
}

/**
 * Returns a JPEG File sized for product upload.
 * Small files that are already fine are returned unchanged.
 */
export async function compressProductImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }
  // Already small enough — skip re-encode (keeps PNG transparency when tiny)
  if (file.size <= TARGET_MAX_BYTES && file.size <= 2 * 1024 * 1024) {
    return file;
  }

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image compression failed");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = JPEG_QUALITY;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);
  while (blob.size > TARGET_MAX_BYTES && quality > 0.45) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "product";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
