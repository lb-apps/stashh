import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a monorepo alongside `backend/`. Without an explicit root,
  // Turbopack walks up past the repo and picks the wrong lockfile.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
