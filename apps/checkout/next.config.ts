import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@nombaone/ui', '@nombaone/sara', '@nombaone/core-contracts', '@nombaone/core-db', '@nombaone/utils', '@nombaone/errors'],
};

export default nextConfig;
