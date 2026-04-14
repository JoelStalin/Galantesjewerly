import type { NextConfig } from "next";

const disableImageOptimization = process.platform === 'android'
  || process.env.NEXT_DISABLE_IMAGE_OPTIMIZATION === '1';

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "googleapis",
    "google-auth-library",
    "@sendgrid/mail",
    "nodemailer",
  ],
  images: {
    unoptimized: disableImageOptimization,
  },
};

export default nextConfig;
