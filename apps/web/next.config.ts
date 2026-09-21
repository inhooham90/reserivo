import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Emits a self-contained server with only the traced dependencies, which is
  // what apps/web/Dockerfile ships. Without it the production image needs the
  // whole monorepo node_modules.
  output: "standalone",
};

// Points next-intl at src/i18n/request.ts, which resolves the locale and loads
// its message table for every server render.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
