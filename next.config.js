import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  allowedDevOrigins: [
    'viewer.localhost',
    'gavoc.localhost',
    'gazetteer.localhost',
    '*.localhost',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
  ],
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(dirname),
      '@/lib': path.resolve(dirname, 'lib'),
      '@/components': path.resolve(dirname, 'components'),
      '@/hooks': path.resolve(dirname, 'hooks'),
      '@/data': path.resolve(dirname, 'data'),
    };
    return config;
  },
};

export default nextConfig;
