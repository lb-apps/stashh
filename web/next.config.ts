import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a monorepo alongside `backend/`. Without an explicit root,
  // Turbopack walks up past the repo and picks the wrong lockfile.
  turbopack: {
    root: __dirname,
  },
};

// The legal pages import their copy from `.mdx` files; elements are mapped to
// Discovery in `mdx-components.tsx`. Plugins are named by string so Turbopack
// can serialise them. GFM turns the bare e-mail addresses into mailto links.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
  },
});

export default withMDX(nextConfig);
