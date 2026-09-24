import { useSyncExternalStore } from "react";

// Jam browser (milidetik, dibulatkan ke detik) yang diperbarui tiap detik. Bernilai null saat render server
// dan hidrasi, jadi HTML tidak memuat waktu yang langsung basi.
const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
};
const snapshot = () => Math.floor(Date.now() / 1000) * 1000;
const serverSnapshot = () => null;

export const useNow = () => useSyncExternalStore(subscribe, snapshot, serverSnapshot);
