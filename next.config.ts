import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@hams-fam/sso-client"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
