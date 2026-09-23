"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  JERSEY_CHEST_CM, JERSEY_SIZES, PAYMENT_METHODS, formatRupiah, issuesToMap, participantSchema,
  type ParticipantInput, type PaymentMethodId,
} from "@/lib/registration";
import { trackPixel } from "@/lib/meta-pixel";

type Category = { id: string; name: string; price: number; saleEnd: string; remaining: number };
type Props = { categories: Category[]; fees: Record<PaymentMethodId, number>; methods: PaymentMethodId[]; paymentMode: "mock" | "off" | "midtrans"; trackCheckout: boolean };

const STEPS = ["Kategori", "Data peserta", "Ringkasan", "Pembayaran"];
const DRAFT_KEY = "kuwera-daftar-draft";
const DRAFT_TTL = 24 * 60 * 60 * 1000;

const emptyParticipant: ParticipantInput = {
  fullName: "", birthDate: "", gender: "L", phone: "", email: "", jerseySize: "M",
  emergencyName: "", emergencyPhone: "", community: "",
};

type Draft = { step: number; categoryId: string; participant: ParticipantInput; savedAt: number };

const slide = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { x: -40, opacity: 0, transition: { duration: 0.25 } },
};

export default function RegistrationForm({ categories, fees, methods, paymentMode, trackCheckout }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [participant, setParticipant] = useState<ParticipantInput>(emptyParticipant);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; discount: number; label: string } | null>(null);
  const [promoMessage, setPromoMessage] = useState("");
  const [agree, setAgree] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>(methods.includes("qris") ? "qris" : methods[0]);
  const available = PAYMENT_METHODS.filter((m) => methods.includes(m.id));
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const category = useMemo(() => categories.find((c) => c.id === categoryId) ?? null, [categories, categoryId]);
  const fee = fees[paymentMethod] ?? 0;
  const subtotal = category?.price ?? 0;
  const discount = promo?.discount ?? 0;
  const total = Math.max(0, subtotal - discount) + fee;

  useEffect(() => {
    trackPixel("ViewContent", { content_name: "Pendaftaran KUWERA Fun Run 5K", value: categories[0]?.price ?? 0, currency: "IDR" });
  }, [categories]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (Date.now() - d.savedAt < DRAFT_TTL) {
          if (categories.some((c) => c.id === d.categoryId)) setCategoryId(d.categoryId);
          setParticipant({ ...emptyParticipant, ...d.participant });
          setStep(Math.min(Math.max(d.step, 1), 3));
        } else localStorage.removeItem(DRAFT_KEY);
      }
    } catch {}
    setHydrated(true);
  }, [categories]);

  useEffect(() => {
    if (!hydrated) return;
    const d: Draft = { step, categoryId, participant, savedAt: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  }, [hydrated, step, categoryId, participant]);

  const validateParticipant = () => {
    const res = participantSchema.safeParse(participant);
    const map = res.success ? {} : issuesToMap(res.error.issues);
    setErrors(map);
    return res.success;
  };

  const set = (k: keyof ParticipantInput, v: string) => {
    setParticipant((p) => ({ ...p, [k]: v }));
    if (touched[k]) {
      const res = participantSchema.safeParse({ ...participant, [k]: v });
      setErrors(res.success ? {} : issuesToMap(res.error.issues));
    }
  };
  const blur = (k: keyof ParticipantInput) => {
    setTouched((t) => ({ ...t, [k]: true }));
    const res = participantSchema.safeParse(participant);
    setErrors(res.success ? {} : issuesToMap(res.error.issues));
  };

  const next = () => {
    setServerError("");
    if (step === 1 && !category) return setServerError("Pilih kategori dulu");
    if (step === 2) {
      setTouched(Object.fromEntries(Object.keys(emptyParticipant).map((k) => [k, true])));
      if (!validateParticipant()) return;
    }
    if (step === 3 && !agree) return setServerError("Centang persetujuan syarat dan ketentuan dulu");
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => { setServerError(""); setStep((s) => Math.max(1, s - 1)); };

  const applyPromo = async () => {
    setPromoMessage("");
    if (!promoInput.trim() || !category) return;
    const res = await fetch("/api/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promoInput, categoryId: category.id }) });
    const data = await res.json();
    if (data.valid) { setPromo({ code: data.code, discount: data.discount, label: data.label }); setPromoMessage(`${data.label} dipakai`); }
    else { setPromo(null); setPromoMessage(data.message ?? "Kode promo tidak berlaku"); }
  };

  const submit = async () => {
    if (!category) return;
    setSubmitting(true); setServerError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: category.id, participant, promoCode: promo?.code ?? "", paymentMethod, agreeTerms: agree }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        setServerError(data.error ?? "Terjadi kesalahan, coba lagi");
        if (data.fields && Object.keys(data.fields).some((k) => k.startsWith("participant."))) setStep(2);
        return;
      }
      localStorage.removeItem(DRAFT_KEY);
      if (trackCheckout) trackPixel("InitiateCheckout", { value: data.total, currency: "IDR", content_name: category.name, num_items: 1, payment_method: paymentMethod }, data.orderId);
      router.push(data.next);
    } catch {
      setServerError("Tidak bisa terhubung ke server, coba lagi");
    } finally {
      setSubmitting(false);
    }
  };

  if (categories.length === 0) {
    return (
      <div className="rounded-[20px] border border-glass-border bg-card p-8 text-center">
        <p className="font-display text-2xl text-brand-yellow uppercase">Pendaftaran belum dibuka</p>
        <p className="mt-2 text-white/70">Ikuti kabar pembukaan lewat newsletter atau WhatsApp panitia.</p>
      </div>
    );
  }

  return (
    <div>
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1; const done = n < step; const active = n === step;
          return (
            <li key={label}>
              <div className="h-1.5 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: done || active ? "100%" : "0%", background: done ? "linear-gradient(90deg, #E3B219, #FDFBF5)" : "#FFBB00" }}
                />
              </div>
              <p className={`mt-2 text-[11px] font-semibold tracking-wide uppercase ${active ? "text-brand-yellow" : done ? "text-white/80" : "text-white/40"}`}>{n}. {label}</p>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 rounded-[20px] border border-glass-border bg-card p-6 sm:p-8">
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 && (
            <motion.div key="s1" variants={slide} initial="enter" animate="center" exit="exit">
              <h2 className="font-display text-2xl text-white uppercase">Pilih kategori</h2>
              <div className="mt-5 grid gap-3">
                {categories.map((c) => {
                  const full = c.remaining <= 0; const selected = c.id === categoryId;
                  return (
                    <button
                      key={c.id} type="button" disabled={full} onClick={() => setCategoryId(c.id)}
                      className={`flex items-center justify-between rounded-2xl border p-5 text-left transition ${selected ? "border-brand-yellow bg-brand-yellow/10" : "border-glass-border bg-white/5 hover:border-white/40"} ${full ? "opacity-50" : ""}`}
                    >
                      <div>
                        <p className="text-lg font-semibold text-white">{c.name}</p>
                        <p className="text-sm text-white/70">{full ? "Kuota penuh" : `Sisa kuota ${c.remaining.toLocaleString("id-ID")}`} &middot; berlaku sampai {new Date(c.saleEnd).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                      </div>
                      <p className="font-display text-2xl text-brand-yellow">{formatRupiah(c.price)}</p>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-sm text-white/75">Pendaftaran perorangan, satu peserta per transaksi. Harga belum termasuk biaya layanan pembayaran.</p>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" variants={slide} initial="enter" animate="center" exit="exit">
              <h2 className="font-display text-2xl text-white uppercase">Data peserta</h2>
              <p className="mt-1 text-sm text-white/75">Isi sesuai KTP. Data ini dipakai untuk BIB dan asuransi.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Nama lengkap" error={errors["fullName"]} className="sm:col-span-2">
                  <input className={inputCls} value={participant.fullName} onChange={(e) => set("fullName", e.target.value)} onBlur={() => blur("fullName")} autoComplete="name" placeholder="Sesuai KTP" />
                </Field>
                <Field label="Tanggal lahir" error={errors["birthDate"]}>
                  <input type="date" className={inputCls} value={participant.birthDate} onChange={(e) => set("birthDate", e.target.value)} onBlur={() => blur("birthDate")} max="2020-12-31" min="1930-01-01" />
                </Field>
                <Field label="Jenis kelamin" error={errors["gender"]}>
                  <div className="grid grid-cols-2 gap-2">
                    {([["L", "Laki-laki"], ["P", "Perempuan"]] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => set("gender", v)} className={pillCls(participant.gender === v)}>{l}</button>
                    ))}
                  </div>
                </Field>
                <Field label="Nomor HP (WhatsApp)" error={errors["phone"]}>
                  <input inputMode="numeric" className={inputCls} value={participant.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))} onBlur={() => blur("phone")} autoComplete="tel" placeholder="08xxxxxxxxxx" />
                </Field>
                <Field label="Email" error={errors["email"]}>
                  <input type="email" className={inputCls} value={participant.email} onChange={(e) => set("email", e.target.value)} onBlur={() => blur("email")} autoComplete="email" placeholder="nama@email.com" />
                </Field>
                <Field label="Ukuran jersey" error={errors["jerseySize"]} className="sm:col-span-2" hint={`Lingkar dada ${JERSEY_SIZES.map((s) => `${s} ${JERSEY_CHEST_CM[s]}`).join(", ")} cm`}>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {JERSEY_SIZES.map((s) => (
                      <button key={s} type="button" onClick={() => set("jerseySize", s)} className={pillCls(participant.jerseySize === s)}>{s}</button>
                    ))}
                  </div>
                </Field>
                <Field label="Nama kontak darurat" error={errors["emergencyName"]}>
                  <input className={inputCls} value={participant.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} onBlur={() => blur("emergencyName")} placeholder="Keluarga atau teman" />
                </Field>
                <Field label="Nomor kontak darurat" error={errors["emergencyPhone"]}>
                  <input inputMode="numeric" className={inputCls} value={participant.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value.replace(/\D/g, ""))} onBlur={() => blur("emergencyPhone")} placeholder="08xxxxxxxxxx" />
                </Field>
                <Field label="Komunitas lari (opsional)" error={errors["community"]} className="sm:col-span-2">
                  <input className={inputCls} value={participant.community ?? ""} onChange={(e) => set("community", e.target.value)} placeholder="Nama komunitas untuk rekap panitia" />
                </Field>
              </div>
            </motion.div>
          )}

          {step === 3 && category && (
            <motion.div key="s3" variants={slide} initial="enter" animate="center" exit="exit">
              <h2 className="font-display text-2xl text-white uppercase">Cek lagi isianmu</h2>
              <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Row k="Kategori" v={category.name} />
                <Row k="Nama" v={participant.fullName} />
                <Row k="Tanggal lahir" v={new Date(participant.birthDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />
                <Row k="Jenis kelamin" v={participant.gender === "L" ? "Laki-laki" : "Perempuan"} />
                <Row k="HP" v={participant.phone} />
                <Row k="Email" v={participant.email} />
                <Row k="Jersey" v={participant.jerseySize} />
                <Row k="Kontak darurat" v={`${participant.emergencyName} (${participant.emergencyPhone})`} />
                {participant.community ? <Row k="Komunitas" v={participant.community} /> : null}
              </dl>
              <button type="button" onClick={() => setStep(2)} className="mt-3 text-sm text-brand-yellow hover:underline">Ubah data</button>

              <div className="mt-6 border-t border-white/10 pt-5">
                <label className="text-sm font-medium text-white">Kode promo (kalau ada)</label>
                <div className="mt-2 flex gap-2">
                  <input className={inputCls} value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder="KUWERA10" />
                  <button type="button" onClick={applyPromo} className="shrink-0 rounded-full border border-brand-yellow px-5 text-sm font-semibold text-brand-yellow hover:bg-brand-yellow/10">Pakai</button>
                </div>
                {promoMessage && <p className={`mt-2 text-sm ${promo ? "text-yellow-lime" : "text-brand-yellow"}`}>{promoMessage}</p>}
              </div>

              <div className="mt-6 rounded-2xl bg-white/5 p-4 text-sm">
                <Line k="Harga tiket" v={formatRupiah(subtotal)} />
                {discount > 0 && <Line k={`Diskon ${promo?.code}`} v={`\u2212${formatRupiah(discount)}`} />}
                <Line k="Biaya layanan" v="ditentukan di langkah pembayaran" muted />
              </div>

              <label className="mt-6 flex items-start gap-3 text-sm text-white/80">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-yellow" />
                <span>Saya menyatakan data di atas benar dan setuju dengan <a href="/syarat" target="_blank" className="text-brand-yellow underline">syarat dan ketentuan</a> KUWERA 5K, termasuk tidak ada pengembalian dana setelah lunas.</span>
              </label>
            </motion.div>
          )}

          {step === 4 && category && (
            <motion.div key="s4" variants={slide} initial="enter" animate="center" exit="exit">
              <h2 className="font-display text-2xl text-white uppercase">Pilih metode pembayaran</h2>
              <p className="mt-1 text-sm text-white/75">Biaya layanan berbeda per metode dan sudah termasuk di total.</p>
              <div className="mt-5 space-y-5">
                {["QRIS", "Virtual account", "E-wallet", "Kartu"].filter((group) => available.some((m) => m.group === group)).map((group) => (
                  <div key={group}>
                    <p className="text-xs font-semibold tracking-wide text-gold uppercase">{group}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {available.filter((m) => m.group === group).map((m) => {
                        const selected = paymentMethod === m.id;
                        return (
                          <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id)} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${selected ? "border-brand-yellow bg-brand-yellow/10" : "border-glass-border bg-white/5 hover:border-white/40"}`}>
                            <span>
                              <span className="block font-medium text-white">{m.label}</span>
                              {m.hint && <span className="block text-xs text-white/75">{m.hint}</span>}
                            </span>
                            <span className="text-sm text-white/80">+{formatRupiah(fees[m.id] ?? 0)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-white/5 p-4 text-sm">
                <Line k="Harga tiket" v={formatRupiah(subtotal)} />
                {discount > 0 && <Line k={`Diskon ${promo?.code}`} v={`\u2212${formatRupiah(discount)}`} />}
                <Line k="Biaya layanan" v={formatRupiah(fee)} />
                <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="font-semibold text-white">Total bayar</span>
                  <span className="font-display text-2xl text-brand-yellow">{formatRupiah(total)}</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/75">
                Kuota kamu ditahan 30 menit sejak klik Bayar. {paymentMode === "mock" ? "Mode pratinjau: pembayaran disimulasikan, tidak ada uang yang ditarik." : paymentMode === "off" ? "Pembayaran online akan dibuka segera." : ""}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {serverError && <p className="mt-5 rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-brand-yellow">{serverError}</p>}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button type="button" onClick={back} disabled={step === 1} className="rounded-full px-5 py-3 text-sm font-semibold text-white/80 hover:text-white disabled:invisible">Kembali</button>
          {step < 4 ? (
            <button type="button" onClick={next} className="rounded-full bg-brand-yellow px-7 py-3 text-sm font-semibold text-green-deep transition-transform hover:translate-x-0.5">Lanjut &rarr;</button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting || paymentMode === "off"} className="rounded-full bg-brand-yellow px-7 py-3 text-sm font-semibold text-green-deep transition-transform hover:translate-x-0.5 disabled:opacity-60">
              {submitting ? "Memproses..." : paymentMode === "off" ? "Pembayaran belum dibuka" : `Bayar ${formatRupiah(total)} →`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-glass-border bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-brand-yellow focus:outline-none";
const pillCls = (on: boolean) => `rounded-xl border px-3 py-3 text-sm font-medium transition ${on ? "border-brand-yellow bg-brand-yellow text-green-deep" : "border-glass-border bg-white/5 text-white hover:border-white/40"}`;

function Field({ label, error, hint, className = "", children }: { label: string; error?: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label className="text-sm font-medium text-white">{label}</label>
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-1.5 text-sm text-yellow-lime">{error}</p> : hint ? <p className="mt-1.5 text-xs text-white/75">{hint}</p> : null}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (<div><dt className="text-white/75">{k}</dt><dd className="font-medium text-white">{v}</dd></div>);
}
function Line({ k, v, muted = false }: { k: string; v: string; muted?: boolean }) {
  return (<div className="flex items-center justify-between py-1"><span className="text-white/70">{k}</span><span className={muted ? "text-white/75" : "text-white"}>{v}</span></div>);
}
