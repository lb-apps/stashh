import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    // Covers and place photos live in Supabase Storage (public buckets).
    remotePatterns: [new URL("https://*.supabase.co/storage/v1/object/public/**")],
  },
  partialPrefetching: true,
  turbopack: {
    // The repo root, so globals.css can import the Discovery tokens from ../web
    // (one source of truth, never copied).
    root: path.join(__dirname, ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
