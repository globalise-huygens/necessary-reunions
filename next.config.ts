import type { NextConfig } from 'next';

const createConfig = async (): Promise<NextConfig> => {
  let userConfig: any = undefined;

  /** @type {import('next').NextConfig} */
  const nextConfig: NextConfig = {
    eslint: {
      ignoreDuringBuilds: true,
    },
    typescript: {
      ignoreBuildErrors: true,
    },
    images: {
      unoptimized: true,
    },
    experimental: {
      webpackBuildWorker: true,
      parallelServerBuildTraces: true,
      parallelServerCompiles: true,
    },
  };

  if (userConfig) {
    const config = userConfig.default || userConfig;
    for (const key in config) {
      if (
        typeof nextConfig[key as keyof NextConfig] === 'object' &&
        !Array.isArray(nextConfig[key as keyof NextConfig])
      ) {
        nextConfig[key as keyof NextConfig] = {
          ...(nextConfig[key as keyof NextConfig] as object),
          ...(config[key] as object),
        };
      } else {
        nextConfig[key as keyof NextConfig] = config[key];
      }
    }
  }

  return nextConfig;
};

export default createConfig();
