/**
 * Image upload storage
 * --------------------
 * One job: save uploaded image files to disk and return a public URL path.
 * Accepts any image/* MIME type (jpeg, png, webp, heic, gif, avif, …).
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, "../../uploads");

/** Ensure uploads folder exists (created on first boot). */
export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function safeExt(originalName = "", mime = "") {
  const fromName = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/gi, "");
  if (fromName && fromName.length <= 8) return fromName;
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
  };
  return map[mime] || ".img";
}

const BLOCKED_IMAGE_TYPES = new Set(["image/svg+xml", "image/svg"]);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const id = crypto.randomBytes(12).toString("hex");
    cb(null, `${Date.now()}-${id}${safeExt(file.originalname, file.mimetype)}`);
  },
});

/**
 * Multer middleware — single file field name "image".
 * Raster images only (SVG blocked — XSS if served as a document).
 */
export const uploadProductImage = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB (client compresses large phone shots first)
  fileFilter(_req, file, cb) {
    const mime = (file.mimetype || "").toLowerCase();
    if (BLOCKED_IMAGE_TYPES.has(mime) || mime.includes("svg")) {
      cb(new Error("SVG uploads are not allowed"));
      return;
    }
    if (mime.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image files are allowed"));
  },
}).single("image");

/** Public path stored in product_images.url */
export function publicUploadPath(filename) {
  return `/uploads/${filename}`;
}
