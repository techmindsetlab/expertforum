import type { NextConfig } from "next";

/**
 * The participant download page is also proxied by the Nada Kreatif Pro
 * website under /case/expertforum (see SHARE_PATH). Everything that page
 * loads therefore lives below that path too: Next.js assets through
 * assetPrefix, brand logos and API calls through the rewrites below. On this
 * app's own domain the rewrites map them straight back, so the kiosk, wall
 * and print desk are unaffected. (Multi-zone pattern from the Next.js docs.)
 */
const SHARE_PATH = "/case/expertforum";
const isBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  assetPrefix: isBuild ? `${SHARE_PATH}/assets` : undefined,
  async rewrites() {
    return {
      beforeFiles: [
        { source: `${SHARE_PATH}/assets/_next/:path+`, destination: "/_next/:path+" },
        { source: `${SHARE_PATH}/brand/:path*`, destination: "/brand/:path*" },
        { source: `${SHARE_PATH}/api/:path*`, destination: "/api/:path*" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
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
