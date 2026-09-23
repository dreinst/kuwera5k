import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import WhatsAppButton from "@/components/WhatsAppButton";
import PageTexture from "@/components/PageTexture";
import MetaPixel from "@/components/MetaPixel";
import { openGraphBase, siteName, siteUrl } from "@/lib/site";

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KUWERA Fun Run 5K Malang 2026 | Sabtu, 24 Oktober",
    template: "%s | KUWERA Fun Run 5K Malang",
  },
  description:
    "Fun run 5K di Malang, Sabtu 24 Oktober 2026, 06.00 WIB di Lapangan Rampal. Rp125.000 di luar biaya layanan, sudah termasuk jersey, BIB, dan medali finisher.",
  applicationName: siteName,
  // og:title dan og:description diwarisi dari title dan description tiap halaman; gambar dari opengraph-image.jpg.
  openGraph: openGraphBase,
  // Izinkan Google menampilkan pratinjau gambar besar dan cuplikan penuh (hasil pencarian dan Discover).
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  // Kode verifikasi Google Search Console (metode tag HTML), diisi lewat env kalau properti didaftarkan.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } } : {}),
  ...(process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION
    ? { other: { "facebook-domain-verification": process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = { themeColor: "#0B4A2C" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${anton.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-green-deep">
        <PageTexture />
        {children}
        <WhatsAppButton />
        <MetaPixel />
      </body>
    </html>
  );
}
