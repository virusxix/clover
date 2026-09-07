/**
 * Admin image upload route
 * ------------------------
 * POST /api/admin/upload  (multipart field: image)
 * Returns { url } for use as product_images.url
 */

import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { uploadProductImage, publicUploadPath } from "../uploads/upload-storage.js";
import { auditFromReq } from "../audit.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.post("/", (req, res) => {
  uploadProductImage(req, res, async (err) => {
    if (err) {
      const msg = err.message || "Upload failed";
      const status = err.code === "LIMIT_FILE_SIZE" ? 400 : 400;
      return res.status(status).json({ error: msg });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    await auditFromReq(req, "product_image_upload", "upload", req.file.filename, {
      size: req.file.size,
      mime: req.file.mimetype,
    });
    res.status(201).json({
      url: publicUploadPath(req.file.filename),
      originalName: req.file.originalname,
      size: req.file.size,
      mime: req.file.mimetype,
    });
  });
});

export default router;
