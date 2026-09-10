import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/label/[file]": ["./public/fonts/**/*"],
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, x-booth-token",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
