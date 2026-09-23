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
      // All Doors Open — private (password-protected) site served by the
      // alldoorsopen Vercel project under /alldoorsopen
      {
        source: "/alldoorsopen",
        destination: "https://alldoorsopen.vercel.app/alldoorsopen",
      },
      {
        source: "/alldoorsopen/:path*",
        destination: "https://alldoorsopen.vercel.app/alldoorsopen/:path*",
      },
      // Rave Lights — controller hosted on the home Pi and exposed through an
      // isolated Tailscale Funnel listener; nested assets and APIs keep the prefix.
      {
        source: "/lights",
        destination: "https://home-pi.tail239537.ts.net:8443/lights",
      },
      {
        source: "/lights/:path*",
        destination: "https://home-pi.tail239537.ts.net:8443/lights/:path*",
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
