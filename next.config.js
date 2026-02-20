import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const alias = {
  '@': path.resolve(dirname),
  '@/lib': path.resolve(dirname, 'lib'),
  '@/components': path.resolve(dirname, 'components'),
  '@/hooks': path.resolve(dirname, 'hooks'),
  '@/data': path.resolve(dirname, 'data'),
};

const nextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
<<<<<<< HEAD
  serverExternalPackages: ['sharp', 'typescript'],
=======
  serverExternalPackages: [
    'leaflet',
    '@allmaps/leaflet',
    'openseadragon',
    'react-leaflet',
    'leaflet.markercluster',
  ],
>>>>>>> 5abc4b1cc8944d22b7c7fb7670497cbed8e1845c
  allowedDevOrigins: [
    'viewer.localhost',
    'gavoc.localhost',
    'gazetteer.localhost',
    '*.localhost',
    '127.0.0.1',
    '127.0.0.1:3000',
    '127.0.0.1:3001',
    'localhost',
    'localhost:3000',
    'localhost:3001',
  ],
  outputFileTracingExcludes: {
    '*': [
      './public/video/**',
      './data/scripts/**',
      './playwright-report/**',
      './test-results/**',
      './tests/**',
    ],
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
  turbopack: {
    resolveAlias: alias,
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...alias,
    };
    return config;
  },
};

export default nextConfig;
