import type { Metadata } from "next";

// Halaman admin tidak boleh masuk mesin pencari.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin KUWERA 5K" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
