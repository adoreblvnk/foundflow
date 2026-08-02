import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The application enforces a stricter 5 MiB image limit after signature validation.
      bodySizeLimit: "6mb",
    },
  },
  // Required for node:sqlite on Vercel (Node.js runtime, not Edge)
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
