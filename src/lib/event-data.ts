// Data dummy sesuai docs/PRD.md bagian 1. Ganti begitu panitia konfirmasi data final.
export const eventData = {
  name: "KUWERA Fun Run 5K 2026",
  city: "Malang, Jawa Timur",
  dateLabel: "Minggu, 13 Desember 2026",
  timeLabel: "06.00 WIB",
  startPoint: "Alun-Alun Tugu (depan Balai Kota Malang)",
  quotaTotal: 1000,
  paidCount: 214,
  registrationOpen: "15 Oktober 2026",
  earlyBirdUntil: "15 November 2026",
  earlyBirdPrice: 150000,
  regularPrice: 200000,
};

export const remainingQuota = eventData.quotaTotal - eventData.paidCount;
