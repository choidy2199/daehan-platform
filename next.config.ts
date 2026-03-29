import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/manager/index.html',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
