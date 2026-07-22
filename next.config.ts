import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The application enforces a stricter 5 MiB image limit after signature validation.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
