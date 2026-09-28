import type { Metadata } from "next";
import SetupForm from "@/components/admin/SetupForm";

export const metadata: Metadata = { title: "Atur kata sandi" };
export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm rounded-[20px] border border-glass-border bg-card p-8">
        <h1 className="font-display text-3xl text-white uppercase">Atur <span className="text-brand-yellow">kata sandi</span></h1>
        <SetupForm token={token} />
      </div>
    </main>
  );
}
