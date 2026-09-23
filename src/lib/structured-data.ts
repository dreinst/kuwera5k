import { eventData, route } from "@/lib/event-data";
import { DEFAULT_FEES } from "@/lib/registration";
import { siteUrl } from "@/lib/site";

// JSON-LD schema.org SportsEvent untuk beranda (PRD bagian 10). Harga mengikuti aturan Google:
// harga terendah termasuk biaya wajib, jadi tiket ditambah biaya layanan pembayaran termurah. Beranda dirender
// statis, jadi kalau biaya layanan di tabel Setting diubah, angka ini baru ikut setelah deploy ulang.
export function eventJsonLd() {
  const lowestFee = Math.min(...Object.values(DEFAULT_FEES));
  const v = eventData.venue;
  const data = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: eventData.name,
    description:
      `Fun run ${route.distanceKm}K di ${eventData.city}, start dan finish di ${v.name} pada ${eventData.dateLabel} ` +
      `pukul ${eventData.timeLabel}. Rp${eventData.price.toLocaleString("id-ID")} per peserta, sudah termasuk jersey, BIB, ` +
      `dan medali finisher. Biaya layanan pembayaran tergantung metode.`,
    sport: "Running",
    startDate: eventData.startIso,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: v.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: v.street,
        addressLocality: v.locality,
        addressRegion: v.region,
        postalCode: v.postalCode,
        addressCountry: "ID",
      },
      geo: { "@type": "GeoCoordinates", latitude: v.lat, longitude: v.lng },
    },
    image: [`${siteUrl}/opengraph-image.jpg`, `${siteUrl}/images/hero-runners.jpg`],
    organizer: { "@type": "Organization", name: eventData.organizer },
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/daftar`,
      price: String(eventData.price + lowestFee),
      priceCurrency: "IDR",
      availability: "https://schema.org/InStock",
      validFrom: eventData.registrationOpenIso,
      validThrough: eventData.registrationCloseIso,
    },
  };
  // "<" di-escape supaya isi JSON tidak bisa menutup tag <script>.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
