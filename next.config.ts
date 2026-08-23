import type { NextConfig } from 'next';

/** Arquivos que o Lab grava. Não podem disparar HMR no meio do POST. */
const LAB_WRITE_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.next/**',
  '**/src/data/vfx/catalog.ts',
  '**/src/data/lab-visual-skills.ts',
  '**/src/data/**/*packs*.ts',
  '**/public/vfx/**',
];

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: LAB_WRITE_IGNORE,
        aggregateTimeout: 600,
      };
    }
    return config;
  },
};

export default nextConfig;
