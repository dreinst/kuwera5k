import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// lastModified = waktu build (setiap deploy), supaya Google tahu kapan isi terakhir berubah.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/daftar`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/syarat`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/privasi`, lastModified, changeFrequency: "monthly", priority: 0.3 },
  ];
}
