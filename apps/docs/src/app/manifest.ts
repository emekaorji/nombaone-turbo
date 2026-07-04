import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nomba One Docs',
    short_name: 'Nomba Docs',
    description:
      'Developer documentation for the Nomba One API: wallets, a double-entry ledger, Nigerian rails, and webhooks.',
    start_url: '/',
    display: 'standalone',
    background_color: '#040404',
    theme_color: '#040404',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
