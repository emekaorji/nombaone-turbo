import type { MetadataRoute } from 'next';

import { listRoutableSlugs } from '@/lib/content';

const BASE = 'https://docs.nombaone.xyz';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await listRoutableSlugs();
  const now = new Date();
  return slugs.map((slug) => ({
    url: `${BASE}${slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: slug === '' ? 1 : 0.7,
  }));
}
