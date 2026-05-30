/** @type {import('next').NextConfig} */
const apiBase =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "halothemes.net", pathname: "/cdn/**" },
    ],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiBase}/api/:path*` },
    ];
  },
};

export default nextConfig;
