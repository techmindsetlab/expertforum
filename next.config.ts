import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local dev database) ships WASM + data files that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],
  // Fonts read at runtime by the OG card renderer and migrations folder for PGlite.
  outputFileTracingIncludes: {
    "/api/art/[id]/card": ["./src/assets/fonts/**/*", "./public/brand/**/*"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  poweredByHeader: false,
};

export default nextConfig;
