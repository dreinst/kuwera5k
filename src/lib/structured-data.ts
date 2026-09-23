import { eventData, faqs, route } from "@/lib/event-data";
import { DEFAULT_FEES } from "@/lib/registration";
import { siteName, siteUrl } from "@/lib/site";

// JSON-LD beranda (PRD bagian 10) dalam satu @graph: SportsEvent, WebSite (nama situs di hasil Google), dan
// FAQPage (isinya sama dengan FAQ yang tampil). Harga event mengikuti aturan Google: harga terendah termasuk
// biaya wajib, jadi tiket ditambah biaya layanan termurah. Kalau biaya layanan di tabel Setting diubah, angka
// ini baru ikut setelah deploy ulang. `remaining` = sisa kuota dari database (null sebelum go-live).
export function homeJsonLd(remaining: number | null) {
  const lowestFee = Math.min(...Object.values(DEFAULT_FEES));
  const v = eventData.venue;
  const start = new Date(eventData.startIso);
  const organizer = { "@type": "Organization", name: eventData.organizer, url: eventData.organizerUrl };
  const event = {
    "@type": "SportsEvent",
    "@id": `${siteUrl}/#event`,
    name: eventData.name,
    description:
      `Fun run ${route.distanceKm}K di ${eventData.city}, start dan finish di ${v.name} pada ${eventData.dateLabel} ` +
      `pukul ${eventData.timeLabel}. Rp${eventData.price.toLocaleString("id-ID")} per peserta, sudah termasuk jersey, BIB, ` +
      `dan medali finisher. Biaya layanan pembayaran tergantung metode.`,
    sport: "Running",
    startDate: eventData.startIso,
    // Selesai = start + batas waktu lari, sama dengan tombol Tambah ke kalender di hero.
    endDate: new Date(start.getTime() + route.cutOffMinutes * 60_000).toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    inLanguage: "id-ID",
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
    organizer,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/daftar`,
      price: String(eventData.price + lowestFee),
      priceCurrency: "IDR",
      availability: remaining === 0 ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      validFrom: eventData.registrationOpenIso,
      validThrough: eventData.registrationCloseIso,
    },
  };
  const website = {
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: `${siteUrl}/`,
    name: siteName,
    alternateName: ["KUWERA 5K", "KUWERA Fun Run"],
    inLanguage: "id-ID",
    publisher: organizer,
  };
  const faq = {
    "@type": "FAQPage",
    "@id": `${siteUrl}/#faq`,
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  // "<" di-escape supaya isi JSON tidak bisa menutup tag <script>.
  return JSON.stringify({ "@context": "https://schema.org", "@graph": [event, website, faq] }).replace(/</g, "\\u003c");
}
