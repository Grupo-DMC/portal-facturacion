import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["mssql", "pdf-lib"],
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
};

export default config;
