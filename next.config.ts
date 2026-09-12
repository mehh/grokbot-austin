import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/label/[file]": ["./public/fonts/**/*"],
    // The OG image is prerendered at build, but keep its two fonts traced (explicit files only,
    // never `public/**`) so it still renders if the route ever runs on demand.
    "/opengraph-image": ["./public/fonts/GeistMono-Bold.ttf", "./public/fonts/GeistMono-Regular.ttf"],
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
