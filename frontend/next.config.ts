import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // KalshiAI dashboard — served by the kalshiai Vercel project under /kalshi
    return [
      {
        source: "/kalshi",
        destination: "https://kalshiai-samarth2709s-projects.vercel.app/kalshi",
      },
      {
        source: "/kalshi/:path*",
        destination: "https://kalshiai-samarth2709s-projects.vercel.app/kalshi/:path*",
      },
    ];
  },
  async redirects() {
    // legacy link from the Polymarket era
    return [
      { source: "/polymarket", destination: "/kalshi", permanent: false },
      { source: "/polymarket/:path*", destination: "/kalshi/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
