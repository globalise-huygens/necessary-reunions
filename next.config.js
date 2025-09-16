const path = require('path');

/** @type {import('next').NextConfig} */
module.exports = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  allowedDevOrigins: [
    'viewer.localhost',
    'gavoc.localhost',
    'gazetteer.localhost',
    '*.localhost',
    '127.0.0.1',
    '127.0.0.1:3000',
  ],
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/components': path.resolve(__dirname, 'components'),
      '@/hooks': path.resolve(__dirname, 'hooks'),
      '@/data': path.resolve(__dirname, 'data'),
    };
    return config;
  },
};
