import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // PolymarketAI dashboard — served by the polymarketai Vercel project under /polymarket
    return [
      {
        source: "/polymarket",
        destination: "https://polymarketai-samarth2709s-projects.vercel.app/polymarket",
      },
      {
        source: "/polymarket/:path*",
        destination: "https://polymarketai-samarth2709s-projects.vercel.app/polymarket/:path*",
      },
    ];
  },
};

export default nextConfig;
