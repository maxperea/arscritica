import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  transpilePackages: ["@arscritica/db"],
  env: { ARSCRITICA_BASE_PATH: basePath ?? "" },
  eslint: { ignoreDuringBuilds: true },
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = [config.externals, { "node:sqlite": "commonjs node:sqlite" }]
        .flat()
        .filter(Boolean);
    }
    return config;
  },
};

export default nextConfig;
