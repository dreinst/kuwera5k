// Alamat publik situs untuk canonical, Open Graph, sitemap, dan data terstruktur.
// Di Vercel produksi terisi otomatis dari domain produksi (ikut pindah kalau nanti domain sendiri dipasang);
// bisa ditimpa lewat NEXT_PUBLIC_SITE_URL.
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://kuwera5k.vercel.app")
).replace(/\/$/, "");

export const siteName = "KUWERA Fun Run 5K Malang";

export const openGraphBase = { type: "website" as const, locale: "id_ID", siteName };

// Canonical dan og:url untuk halaman publik. openGraph di halaman menimpa milik layout seluruhnya, termasuk
// gambar dari src/app/opengraph-image.jpg, jadi dasar dan gambarnya ikut disebar di sini (judul dan deskripsi
// tetap diisi Next dari metadata halaman). Di beranda file opengraph-image yang dipakai.
export const pageMeta = (path: string) => ({
  alternates: { canonical: path },
  openGraph: {
    ...openGraphBase,
    url: path,
    images: [{
      url: "/opengraph-image.jpg", width: 1200, height: 630, type: "image/jpeg",
      alt: "KUWERA Fun Run 5K Malang, Sabtu 24 Oktober 2026 pukul 06.00 WIB, start dan finish di Lapangan Rampal",
    }],
  },
});
