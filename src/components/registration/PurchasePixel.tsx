"use client";

import { useEffect } from "react";
import { META_PIXEL_ID, trackPixel } from "@/lib/meta-pixel";

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Event Purchase untuk iklan Meta, dikirim sekali per tiket (eventID = nomor order, siap dideduplikasi
// kalau nanti Conversions API dipasang). Hanya untuk pembayaran Midtrans production, bukan sandbox atau
// simulasi, dan hanya 24 jam pertama setelah lunas: tiket yang dibuka lagi saat ambil race pack, atau di
// browser lain, tidak dihitung sebagai pembelian baru.
export default function PurchasePixel({ orderId, value, category, paidAt }: { orderId: string; value: number; category: string; paidAt: string }) {
  useEffect(() => {
    if (!META_PIXEL_ID || Date.now() - Date.parse(paidAt) > WINDOW_MS) return;
    const key = `kuwera-pixel-purchase-${orderId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Penyimpanan diblokir browser: tetap kirim sekali untuk kunjungan ini.
    }
    trackPixel("Purchase", { value, currency: "IDR", content_name: category, content_type: "product", num_items: 1 }, orderId);
  }, [orderId, value, category, paidAt]);
  return null;
}
