const path = require('path');

// Override console logging to suppress cache skip messages
const originalLog = console.log;
console.log = (...args) => {
  const message = args.join(' ');
  if (
    message.includes('cache skip') ||
    message.includes('Cache skipped reason') ||
    message.includes('External API response for page') ||
    (message.includes('GET ') &&
      message.includes('in ') &&
      message.includes('ms')) ||
    (message.includes('POST ') &&
      message.includes('in ') &&
      message.includes('ms')) ||
    (message.includes('DELETE ') &&
      message.includes('in ') &&
      message.includes('ms'))
  ) {
    return; // Skip these log messages
  }
  originalLog.apply(console, args);
};

/** @type {import('next').NextConfig} */
module.exports = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  logging: {
    fetches: {
      fullUrl: false,
      hmrRefreshes: false,
      enabled: false,
    },
    level: 'silent',
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
