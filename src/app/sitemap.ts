import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/daftar`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/syarat`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/privasi`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
