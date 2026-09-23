import { getAdmin } from "@/lib/admin-auth";
import AdminNav from "@/components/admin/AdminNav";

// Hanya tampilan. Pemeriksaan akses tetap dilakukan di setiap halaman lewat requireAdmin().
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  return (
    <>
      {admin && <AdminNav username={admin.username} role={admin.role} />}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pt-10 pb-24">{children}</main>
    </>
  );
}
