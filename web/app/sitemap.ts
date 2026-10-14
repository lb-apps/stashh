import type { MetadataRoute } from "next";

const SITE = "https://stashh.me";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE}/data-deletion`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
