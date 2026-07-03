import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/kitchen-sink"] },
    sitemap: "https://nombaone.xyz/sitemap.xml",
    host: "https://nombaone.xyz",
  };
}
