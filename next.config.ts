import type { NextConfig } from "next";

// CSP tanpa nonce (panduan CSP Next 16, "Without Nonces"), supaya beranda tetap statis. Host pihak ketiga
// yang dimuat: Midtrans Snap (snap.js dan iframe pembayaran), Cloudflare Turnstile, dan Meta Pixel.
const isDev = process.env.NODE_ENV === "development";
const midtrans = "https://app.midtrans.com https://app.sandbox.midtrans.com";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${midtrans} https://challenges.cloudflare.com https://connect.facebook.net`,
  `frame-src ${midtrans} https://challenges.cloudflare.com`,
  `connect-src 'self' ${midtrans} https://api.midtrans.com https://api.sandbox.midtrans.com https://challenges.cloudflare.com https://www.facebook.com https://connect.facebook.net`,
  "img-src 'self' data: blob: https://www.facebook.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Build Docker untuk VPS (lihat Dockerfile) memakai output standalone; build Vercel tidak terpengaruh.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Vercel menambahkan HSTS sendiri; di VPS (Traefik) header ini harus dari aplikasi.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Salinan uji di alamat sementara tidak boleh diindeks (dibaca saat build).
          ...(process.env.SITE_NOINDEX === "1" ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
