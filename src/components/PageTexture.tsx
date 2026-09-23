// Tekstur jersey untuk seluruh halaman: satu lapisan tetap di belakang semua konten, jadi latar
// menyambung tanpa bidang polos di antara section. Kartu dan form memakai gradasi sendiri, tanpa tekstur.
export default function PageTexture() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 80% 55% at 10% 0%, rgba(244,231,29,0.06), transparent 60%), " +
          "radial-gradient(ellipse 70% 50% at 100% 100%, rgba(100,163,34,0.18), transparent 65%), " +
          "linear-gradient(170deg, #0E5530 0%, #0B4A2C 50%, #093F25 100%)",
      }}
    >
      {/* serat kain: grid titik sangat halus di seluruh layar */}
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle, #F4E71D 1.1px, transparent 1.6px)", backgroundSize: "22px 22px" }} />
      {/* titik halftone seperti bahu jersey: kanan atas dan kiri bawah */}
      <div className="absolute top-0 right-0 h-[250px] w-[380px] opacity-[0.18] sm:h-[400px] sm:w-[610px]" style={{ backgroundImage: "url(/images/jersey-dots.svg)", backgroundSize: "100% 100%" }} />
      <div className="absolute bottom-0 left-0 h-[200px] w-[300px] rotate-180 opacity-15 sm:h-[320px] sm:w-[490px]" style={{ backgroundImage: "url(/images/jersey-dots.svg)", backgroundSize: "100% 100%" }} />
      {/* pita bergelombang ujung bawah jersey, tipis supaya teks di atasnya tetap terbaca */}
      <div
        className="absolute inset-x-0 bottom-0 h-[38vh]"
        style={{
          backgroundImage: "url(/images/jersey-waves.webp)", backgroundSize: "cover", backgroundPosition: "center bottom", opacity: 0.2,
          maskImage: "linear-gradient(to top, #000 30%, transparent)", WebkitMaskImage: "linear-gradient(to top, #000 30%, transparent)",
        }}
      />
    </div>
  );
}
