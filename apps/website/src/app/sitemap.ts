import type { MetadataRoute } from "next";

import { listAllSlugs } from "@/lib/content";

const BASE = "https://nombaone.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    "",
    "/product",
    "/integrations",
    "/use-cases",
    "/use-cases/school-fees",
    "/pricing",
    "/trust",
    "/guides",
    "/changelog",
    "/hall",
  ];
  const pages: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${BASE}${route}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
  const guides: MetadataRoute.Sitemap = listAllSlugs().map((slug) => ({
    url: `${BASE}/guides/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [...pages, ...guides];
}
