/**
 * API server entry
 * ----------------
 * One job: wire middleware + route modules and listen on PORT.
 * No business logic here — only HTTP plumbing.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import cartRoutes from "./routes/cart.js";
import orderRoutes from "./routes/orders.js";
import wishlistRoutes from "./routes/wishlist.js";
import adminRoutes from "./routes/admin.js";
import adminOpsRoutes from "./routes/admin-ops.js";
import adminUploadRoutes from "./routes/admin-upload.js";
import { query } from "./db.js";
import { ensureUploadDir, UPLOAD_DIR } from "./uploads/upload-storage.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

/** Allowed browser origins (Vercel storefront + local). Comma-separated CLIENT_URLS supported. */
function allowedOrigins() {
  const fromEnv = [process.env.CLIENT_URL, ...(process.env.CLIENT_URLS || "").split(",")]
    .map((s) => String(s || "").trim().replace(/\/$/, ""))
    .filter(Boolean);
  return fromEnv.length ? fromEnv : ["http://localhost:3000"];
}

function corsOrigin(origin, callback) {
  // Non-browser / same-server requests (health checks, SSR rewrite proxy) have no Origin
  if (!origin) return callback(null, true);
  const normalized = origin.replace(/\/$/, "");
  if (allowedOrigins().includes(normalized)) return callback(null, true);
  if (process.env.CORS_VERCEL_PREVIEWS === "true") {
    try {
      const host = new URL(origin).hostname;
      if (host === "vercel.app" || host.endsWith(".vercel.app")) return callback(null, true);
    } catch {
      /* ignore */
    }
  }
  callback(new Error(`CORS blocked for origin: ${origin}`));
}

ensureUploadDir();

// Render (and most hosts) sit behind a proxy — needed for correct rate-limit IPs.
app.set("trust proxy", 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Serve uploaded product photos at /uploads/*
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d", fallthrough: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, try again later" },
});

/**
 * Liveness + DB readiness.
 * Returns 503 when Postgres is unreachable so load balancers / ops notice.
 */
app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, service: "clover-api", db: true });
  } catch (err) {
    console.error("[health]", err.message);
    res.status(503).json({ ok: false, service: "clover-api", db: false });
  }
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/ops", adminOpsRoutes);
app.use("/api/admin/upload", adminUploadRoutes);

app.use((err, _req, res, _next) => {
  console.error("[unhandled]", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`THE CLOVER API running on http://localhost:${PORT}`);
});
