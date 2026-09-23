// Tekstur latar yang meniru jersey KUWERA: rona kuning di atas, titik halftone kuning di pojok
// (seperti bagian bahu), dan pita hijau bergelombang di bawah (seperti ujung bawah jersey).
// Taruh sebagai anak pertama elemen yang `relative overflow-hidden`; konten sesudahnya diberi `relative`.
type Props = {
  dots?: "left" | "right" | "none";
  waves?: boolean;
  glow?: boolean;
  dotsOpacity?: number;
  wavesOpacity?: number;
  wavesHeight?: string;
};

export default function JerseyTexture({ dots = "right", waves = false, glow = true, dotsOpacity = 0.28, wavesOpacity = 0.45, wavesHeight = "h-[260px] sm:h-[380px]" }: Props) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {glow && (
        <div
          className="absolute inset-x-0 top-0 h-[480px]"
          style={{ background: "linear-gradient(180deg, rgba(244,231,29,0.10) 0%, rgba(100,163,34,0.07) 40%, transparent 100%)" }}
        />
      )}
      {dots !== "none" && (
        <div
          className={`absolute top-0 h-[250px] w-[380px] sm:h-[400px] sm:w-[610px] ${dots === "left" ? "left-0 -scale-x-100" : "right-0"}`}
          style={{ backgroundImage: "url(/images/jersey-dots.svg)", backgroundSize: "100% 100%", opacity: dotsOpacity }}
        />
      )}
      {waves && (
        <div
          className={`absolute inset-x-0 bottom-0 ${wavesHeight}`}
          style={{
            backgroundImage: "url(/images/jersey-waves.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center bottom",
            opacity: wavesOpacity,
            // memudar ke atas supaya pita tidak terpotong keras dan teks di atasnya tetap terbaca
            maskImage: "linear-gradient(to top, #000 40%, transparent)",
            WebkitMaskImage: "linear-gradient(to top, #000 40%, transparent)",
          }}
        />
      )}
    </div>
  );
}
