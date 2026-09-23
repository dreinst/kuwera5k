import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin-auth";
import LoginForm from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Masuk" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm rounded-[20px] border border-glass-border bg-card p-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statis */}
        <img src="/brand/kuwera-logo-light.svg" alt="KUWERA Fun Run" width={2400} height={853} className="mx-auto h-12 w-auto" />
        <h1 className="font-display mt-6 text-center text-3xl text-white uppercase">Masuk <span className="text-brand-yellow">admin</span></h1>
        <LoginForm />
      </div>
    </main>
  );
}
