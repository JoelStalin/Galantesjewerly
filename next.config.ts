import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const disableImageOptimization = process.platform === 'android'
  || process.env.NEXT_DISABLE_IMAGE_OPTIMIZATION === '1';
const projectRoot = dirname(fileURLToPath(new URL('.', import.meta.url)));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
          },
        ],
      },
    ];
  },
  serverExternalPackages: [
    "googleapis",
    "google-auth-library",
    "@sendgrid/mail",
    "nodemailer",
  ],
  images: {
    unoptimized: disableImageOptimization,
    localPatterns: [
      {
        pathname: '/api/products/image',
        search: '?*',
      },
      {
        pathname: '/api/image',
        search: '?*',
      },
      {
        pathname: '/assets/**',
      },
    ],
    remotePatterns: [
      // Odoo local/Docker instance
      { protocol: 'http', hostname: 'localhost', port: '8069', pathname: '/web/image/**' },
      { protocol: 'http', hostname: 'odoo', port: '8069', pathname: '/web/image/**' },
      // Odoo production subdomain
      { protocol: 'https', hostname: 'shop.galantesjewelry.com', pathname: '/web/image/**' },
      { protocol: 'https', hostname: 'odoo.galantesjewelry.com', pathname: '/web/image/**' },
      // External placeholders
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.pexels.com', pathname: '/**' },
    ],
  },
};

export default nextConfig;
