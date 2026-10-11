import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Public deployment class is baked into both server and browser bundles.
  // A local build defaults to development; NODE_ENV=production is not approval
  // to connect to the production database.
  env: {
    NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV: process.env.VERCEL_ENV ?? "development",
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
