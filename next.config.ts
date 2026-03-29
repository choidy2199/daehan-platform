import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/manager/index.html',
        destination: '/',
        permanent: true,
      },
      {
        source: '/manager',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
