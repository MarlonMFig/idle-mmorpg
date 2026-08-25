import type { NextConfig } from 'next';

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
    // Não ignorar src/data/*packs.ts: o Lab grava esses ficheiros e o F5
    // precisa de recompilar o bundle a partir do disco. O write é adiado
    // para depois do JSON 200 (processo Node separado) para o POST não morrer.
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        aggregateTimeout: 600,
      };
    }
    return config;
  },
};

export default nextConfig;
