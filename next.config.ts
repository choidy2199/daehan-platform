import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/manager',
        destination: '/manager/index.html',
      },
    ];
  },
};

export default nextConfig;
