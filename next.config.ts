import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "*": [
      "./.tools/**",
      "./dist/**",
      "./dist-portable/**",
      "./dist-portable-final/**",
      "./dist-portable-ready/**",
      "./local-data/**",
      "./*.zip",
      "./*.log",
    ],
  },
};

export default nextConfig;
