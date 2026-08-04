import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The vinext starter includes Cloudflare-only worker and D1 sources. Keep
  // those in the regular TypeScript project while Vercel type-checks only the
  // native Next.js application surface.
  typescript: {
    tsconfigPath: "./tsconfig.vercel.json",
  },
};

export default nextConfig;
