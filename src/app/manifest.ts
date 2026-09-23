import type { MetadataRoute } from "next";
import { siteName } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "KUWERA 5K",
    description: "Fun run 5K di Malang, Sabtu 24 Oktober 2026 di Lapangan Rampal.",
    start_url: "/",
    display: "browser",
    background_color: "#0B4A2C",
    theme_color: "#0B4A2C",
    lang: "id",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
