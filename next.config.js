// const MillionLint = require('@million/lint');
const path = require('path');

/** @type {import('next').NextConfig} */
module.exports =
  // MillionLint.next({
  //   enabled: false,
  //   rsc: true,
  //   telemetry: false, // Disable telemetry to prevent fetch errors
  // })
  {
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: true },
    images: { unoptimized: true },
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
