// Lingkaran panah di ujung tombol pil, seperti tombol "Register here" di video konsep.
export default function ArrowCircle({ dark = true, small = false }: { dark?: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full ${small ? "h-7 w-7" : "h-9 w-9"} ${dark ? "bg-green-deep text-brand-yellow" : "bg-brand-yellow text-green-deep"}`}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10h12M11 5l5 5-5 5" />
      </svg>
    </span>
  );
}
