/** @type {import('next').NextConfig} */
const rawApi = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/$/, "");
const apiBase = rawApi || "http://localhost:4000";

// On Vercel, missing API URL makes every page rewrite to localhost and crash in production.
if (process.env.VERCEL && !/^https?:\/\//i.test(rawApi)) {
  console.warn(
    "[clover] NEXT_PUBLIC_API_URL is not set. Add your Render API URL in Vercel → Environment Variables, then redeploy."
  );
}

const nextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "halothemes.net", pathname: "/cdn/**" },
    ],
  },
  async rewrites() {
    // /api/* is handled by app/api/[...path] (cookie-safe proxy).
    // Only proxy uploaded product images to the API host.
    if (process.env.VERCEL && !/^https:\/\//i.test(rawApi)) {
      return [];
    }
    return [{ source: "/uploads/:path*", destination: `${apiBase}/uploads/:path*` }];
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          // Next.js needs some inline scripts; avoid unsafe-eval in production builds when possible.
          isProd
            ? "script-src 'self' 'unsafe-inline'"
            : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          `connect-src 'self' ${rawApi || "http://localhost:4000"}`,
          "upgrade-insecure-requests",
        ].join("; "),
      },
    ];
    if (isProd) {
      security.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      { source: "/:path*", headers: security },
      {
        source: "/assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
