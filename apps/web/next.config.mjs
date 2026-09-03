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
    return [
      {
        source: "/assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
