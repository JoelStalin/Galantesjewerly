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
    remotePatterns: [
      // Odoo local/Docker instance
      { protocol: 'http', hostname: 'localhost', port: '8069', pathname: '/web/image/**' },
      { protocol: 'http', hostname: 'odoo', port: '8069', pathname: '/web/image/**' },
      // Odoo production subdomain
      { protocol: 'https', hostname: 'shop.galantesjewelry.com', pathname: '/**' },
      { protocol: 'https', hostname: 'odoo.galantesjewelry.com', pathname: '/**' },
      // Odoo Cloudflare tunnel (if applicable)
      { protocol: 'https', hostname: '*.galantesjewelry.com', pathname: '/**' },
      // External placeholders
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.pexels.com', pathname: '/**' },
    ],
  },
};

export default nextConfig;
