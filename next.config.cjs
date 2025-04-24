// next.config.cjs
const path = require('path');

/** @type {import('next').NextConfig} */
module.exports = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
  webpack(config) {
    const root = path.resolve(__dirname);
    config.resolve.alias = {
      ...config.resolve.alias,

      '@': root,
      '@/lib': path.resolve(root, 'lib'),
    };
    return config;
  },
};
