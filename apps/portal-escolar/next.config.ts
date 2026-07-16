import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@preparatoria/env",
    "@preparatoria/shared",
    "@preparatoria/supabase",
    "@preparatoria/ui",
  ],
};

export default nextConfig;
