import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/tools/boundary-check",
        destination: "/tools/decision",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
