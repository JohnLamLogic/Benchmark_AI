import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['jspdf', '@prisma/client'],
};

export default nextConfig;
