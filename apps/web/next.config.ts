import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server with only the traced dependencies, which is
  // what apps/web/Dockerfile ships. Without it the production image needs the
  // whole monorepo node_modules.
  output: "standalone",
};

export default nextConfig;
