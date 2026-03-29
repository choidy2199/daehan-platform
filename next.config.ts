import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/manager/index.html',
        destination: '/manager',
        permanent: true,
      },
    ];
  },
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
