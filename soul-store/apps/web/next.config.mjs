/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "halothemes.net", pathname: "/cdn/**" },
    ],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:4000/api/:path*" },
    ];
  },
};

export default nextConfig;
