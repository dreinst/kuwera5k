import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// /bayar dan /tiket sengaja tidak diblokir di sini: halamannya memakai meta noindex, dan Google hanya bisa
// membaca noindex kalau halaman boleh di-crawl.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
