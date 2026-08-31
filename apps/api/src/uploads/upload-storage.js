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
    "image/svg+xml": ".svg",
  };
  return map[mime] || ".img";
}

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
 * accept: any MIME that starts with image/
 */
export const uploadProductImage = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter(_req, file, cb) {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
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
