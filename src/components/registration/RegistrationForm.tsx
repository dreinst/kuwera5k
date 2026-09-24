"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BLOOD_TYPES, JERSEY_CHART, JERSEY_CHART_COLUMNS, JERSEY_SIZES, PAYMENT_METHODS, PROVINCES, formatRupiah, fullNameOf, issuesToMap,
  participantSchema, type ParticipantForm, type PaymentMethodId,
} from "@/lib/registration";
import { trackPixel } from "@/lib/meta-pixel";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/registration/Turnstile";
import { KAB_KOTA } from "@/lib/wilayah";

type Category = { id: string; name: string; price: number; saleEnd: string; remaining: number };
type Props = { categories: Category[]; fees: Record<PaymentMethodId, number>; methods: PaymentMethodId[]; paymentMode: "mock" | "off" | "midtrans"; trackCheckout: boolean };

const STEPS = ["Kategori", "Data peserta", "Ringkasan", "Pembayaran"];
const DRAFT_KEY = "kuwera-daftar-draft";
const DRAFT_TTL = 24 * 60 * 60 * 1000;

const emptyParticipant: ParticipantForm = {
  firstName: "", lastName: "", email: "", phone: "", idNumber: "", address: "", province: "", city: "", postalCode: "",
  birthDate: "", gender: "", bloodType: "", emergencyName: "", emergencyPhone: "", jerseySize: "M", community: "",
};

type Draft = { step: number; categoryId: string; participant: ParticipantForm; savedAt: number };

const slide = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { x: -40, opacity: 0, transition: { duration: 0.25 } },
};

// Draf 24 jam terakhir dari localStorage; null kalau tidak ada, rusak, atau kedaluwarsa.
function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const d = raw ? (JSON.parse(raw) as Draft) : null;
    return d && Date.now() - d.savedAt < DRAFT_TTL ? d : null;
  } catch {
    return null;
  }
}

const noSubscribe = () => () => {};

// Draf hanya ada di browser. Form dirender dulu tanpa draf (sama dengan HTML server), lalu dipasang ulang
// sekali dengan isi draf begitu berjalan di browser. Hanya pasangan browser yang menyimpan draf.
export default function RegistrationForm(props: Props) {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  const { categories } = props;
  useEffect(() => {
    trackPixel("ViewContent", { content_name: "Pendaftaran KUWERA Fun Run 5K", value: categories[0]?.price ?? 0, currency: "IDR" });
  }, [categories]);
  return <FormSteps key={inBrowser ? "browser" : "server"} {...props} draft={inBrowser ? readDraft() : null} saveDraft={inBrowser} />;
}

function FormSteps({ categories, fees, methods, paymentMode, trackCheckout, draft, saveDraft }: Props & { draft: Draft | null; saveDraft: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(() => (draft ? Math.min(Math.max(draft.step, 1), 3) : 1));
  const [categoryId, setCategoryId] = useState(() =>
    draft && categories.some((c) => c.id === draft.categoryId) ? draft.categoryId : categories[0]?.id ?? "",
  );
  const [participant, setParticipant] = useState<ParticipantForm>(() => {
    if (!draft) return emptyParticipant;
    const p = { ...emptyParticipant, ...draft.participant };
    if (p.jerseySize === "XXL") p.jerseySize = "2XL"; // draf lama, ukuran XXL sekarang bernama 2XL
    return p;
  });
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
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  const category = useMemo(() => categories.find((c) => c.id === categoryId) ?? null, [categories, categoryId]);
  const fee = fees[paymentMethod] ?? 0;
  const subtotal = category?.price ?? 0;
  const discount = promo?.discount ?? 0;
  const total = Math.max(0, subtotal - discount) + fee;

  useEffect(() => {
    if (!saveDraft) return;
    const d: Draft = { step, categoryId, participant, savedAt: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  }, [saveDraft, step, categoryId, participant]);

  const validateParticipant = () => {
    const res = participantSchema.safeParse(participant);
    const map = res.success ? {} : issuesToMap(res.error.issues);
    setErrors(map);
    return res.success;
  };

  // Pesan error hanya untuk kolom yang sudah disentuh. Kalau semua kolom ikut divalidasi, error kolom yang
  // belum diisi muncul lalu hilang saat fokus pindah, tata letak bergeser, dan klik tombol Lanjut meleset.
  const visibleErrors = (p: ParticipantForm, t: Record<string, boolean>) => {
    const res = participantSchema.safeParse(p);
    if (res.success) return {};
    return Object.fromEntries(Object.entries(issuesToMap(res.error.issues)).filter(([k]) => t[k]));
  };
  const set = (k: keyof ParticipantForm, v: string, extra: Partial<ParticipantForm> = {}) => {
    const nextP = { ...participant, ...extra, [k]: v };
    setParticipant(nextP);
    if (touched[k]) setErrors(visibleErrors(nextP, touched));
  };
  const blur = (k: keyof ParticipantForm) => {
    const t = { ...touched, [k]: true };
    setTouched(t);
    setErrors(visibleErrors(participant, t));
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
        body: JSON.stringify({ categoryId: category.id, participant, promoCode: promo?.code ?? "", paymentMethod, agreeTerms: agree, turnstileToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTurnstileReset((n) => n + 1); // token Turnstile hanya berlaku sekali
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
        <p className="mt-2 text-white/70">Tanyakan jadwal pembukaannya ke WhatsApp panitia.</p>
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
              <p className="mt-1 text-sm text-white/75">Isi sesuai KTP atau KIA. Data ini dipakai untuk BIB, asuransi, dan verifikasi saat ambil race pack.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Nama depan" error={errors["firstName"]}>
                  <input className={inputCls} value={participant.firstName} onChange={(e) => set("firstName", e.target.value)} onBlur={() => blur("firstName")} autoComplete="given-name" placeholder="Sesuai KTP/KIA" />
                </Field>
                <Field label="Nama belakang" error={errors["lastName"]} hint="Kosongkan kalau namamu hanya satu kata">
                  <input className={inputCls} value={participant.lastName} onChange={(e) => set("lastName", e.target.value)} onBlur={() => blur("lastName")} autoComplete="family-name" placeholder="Sesuai KTP/KIA" />
                </Field>
                <Field label="Email" error={errors["email"]}>
                  <input type="email" className={inputCls} value={participant.email} onChange={(e) => set("email", e.target.value)} onBlur={() => blur("email")} autoComplete="email" placeholder="nama@email.com" />
                </Field>
                <Field label="Nomor HP (WhatsApp)" error={errors["phone"]}>
                  <input inputMode="numeric" className={inputCls} value={participant.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))} onBlur={() => blur("phone")} autoComplete="tel" placeholder="08xxxxxxxxxx" />
                </Field>
                <Field label="Nomor identitas (KTP/KIA)" error={errors["idNumber"]} hint="Pastikan nomor identitas benar karena akan digunakan untuk verifikasi" className="sm:col-span-2">
                  <input inputMode="numeric" maxLength={16} className={inputCls} value={participant.idNumber} onChange={(e) => set("idNumber", e.target.value.replace(/\D/g, ""))} onBlur={() => blur("idNumber")} autoComplete="off" placeholder="16 angka NIK" />
                </Field>
                <Field label="Alamat" error={errors["address"]} className="sm:col-span-2">
                  <input className={inputCls} value={participant.address} onChange={(e) => set("address", e.target.value)} onBlur={() => blur("address")} autoComplete="street-address" placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan" />
                </Field>
                <Field label="Provinsi" error={errors["province"]}>
                  <Select value={participant.province} onChange={(v) => set("province", v, v !== participant.province ? { city: "" } : {})} onBlur={() => blur("province")} placeholder="Pilih provinsi" options={PROVINCES.map((p) => [p, p])} autoComplete="address-level1" />
                </Field>
                <Field label="Kota/kabupaten" error={errors["city"]}>
                  {/* Daftar kabupaten/kota mengikuti provinsi yang dipilih; kosong sampai provinsi dipilih. */}
                  <Select
                    value={participant.city} onChange={(v) => set("city", v)} onBlur={() => blur("city")}
                    placeholder={participant.province ? "Pilih kota/kabupaten" : "Pilih provinsi dulu"}
                    options={(KAB_KOTA[participant.province] ?? []).map((c) => [c, c])} autoComplete="address-level2"
                    disabled={!participant.province}
                  />
                </Field>
                <Field label="Kode pos" error={errors["postalCode"]}>
                  <input inputMode="numeric" maxLength={5} className={inputCls} value={participant.postalCode} onChange={(e) => set("postalCode", e.target.value.replace(/\D/g, ""))} onBlur={() => blur("postalCode")} autoComplete="postal-code" placeholder="5 angka" />
                </Field>
                <Field label="Tanggal lahir" error={errors["birthDate"]}>
                  <input type="date" className={inputCls} value={participant.birthDate} onChange={(e) => set("birthDate", e.target.value)} onBlur={() => blur("birthDate")} max="2020-12-31" min="1930-01-01" autoComplete="bday" />
                </Field>
                <Field label="Jenis kelamin" error={errors["gender"]}>
                  <Select value={participant.gender} onChange={(v) => set("gender", v)} onBlur={() => blur("gender")} placeholder="Pilih jenis kelamin" options={[["L", "Laki-laki"], ["P", "Perempuan"]]} />
                </Field>
                <Field label="Golongan darah" error={errors["bloodType"]}>
                  <Select value={participant.bloodType} onChange={(v) => set("bloodType", v)} onBlur={() => blur("bloodType")} placeholder="Pilih golongan darah" options={BLOOD_TYPES.map((b) => [b, b])} />
                </Field>
                <Field label="Nama kontak darurat" error={errors["emergencyName"]}>
                  <input className={inputCls} value={participant.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} onBlur={() => blur("emergencyName")} placeholder="Keluarga atau teman" />
                </Field>
                <Field label="Nomor HP kontak darurat" error={errors["emergencyPhone"]}>
                  <input inputMode="numeric" className={inputCls} value={participant.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value.replace(/\D/g, ""))} onBlur={() => blur("emergencyPhone")} placeholder="08xxxxxxxxxx" />
                </Field>
                <Field label="Ukuran jersey" error={errors["jerseySize"]} className="sm:col-span-2">
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {JERSEY_SIZES.map((s) => (
                      <button key={s} type="button" onClick={() => set("jerseySize", s)} className={pillCls(participant.jerseySize === s)}>{s}</button>
                    ))}
                  </div>
                  <SizeChart />
                </Field>
                <Field label="Komunitas lari (opsional)" error={errors["community"]} className="sm:col-span-2">
                  <input className={inputCls} value={participant.community} onChange={(e) => set("community", e.target.value)} placeholder="Nama komunitas untuk rekap panitia" />
                </Field>
              </div>
            </motion.div>
          )}

          {step === 3 && category && (
            <motion.div key="s3" variants={slide} initial="enter" animate="center" exit="exit">
              <h2 className="font-display text-2xl text-white uppercase">Cek lagi isianmu</h2>
              <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Row k="Kategori" v={category.name} />
                <Row k="Nama" v={fullNameOf(participant)} />
                <Row k="Nomor identitas" v={participant.idNumber} />
                <Row k="Tanggal lahir" v={new Date(participant.birthDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />
                <Row k="Jenis kelamin" v={participant.gender === "L" ? "Laki-laki" : "Perempuan"} />
                <Row k="Golongan darah" v={participant.bloodType} />
                <Row k="HP" v={participant.phone} />
                <Row k="Email" v={participant.email} />
                <Row k="Alamat" v={`${participant.address}, ${participant.city}, ${participant.province} ${participant.postalCode}`} />
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
                <span>Saya menyatakan data di atas benar dan setuju dengan <a href="/syarat" target="_blank" className="text-brand-yellow underline">syarat dan ketentuan</a> KUWERA 5K, termasuk biaya yang sudah lunas tidak dikembalikan otomatis.</span>
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
              <Turnstile onToken={setTurnstileToken} resetSignal={turnstileReset} />
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
            <button type="button" onClick={submit} disabled={submitting || paymentMode === "off" || (!!TURNSTILE_SITE_KEY && !turnstileToken)} className="rounded-full bg-brand-yellow px-7 py-3 text-sm font-semibold text-green-deep transition-transform hover:translate-x-0.5 disabled:opacity-60">
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

function Select({ value, onChange, onBlur, placeholder, options, autoComplete, disabled = false }: {
  value: string; onChange: (v: string) => void; onBlur: () => void; placeholder: string;
  options: readonly (readonly [string, string])[]; autoComplete?: string; disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        className={`${inputCls} appearance-none pr-10 disabled:cursor-not-allowed disabled:opacity-60 ${value ? "" : "text-white/40"} [&>option]:bg-green-deep [&>option]:text-white`}
        value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} autoComplete={autoComplete} disabled={disabled}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-white/70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8l5 5 5-5" />
      </svg>
    </div>
  );
}

// Size chart O-neck reguler (cm), sumbernya di src/lib/registration.ts.
function SizeChart() {
  const cm = (n: number) => n.toLocaleString("id-ID");
  return (
    <details className="mt-3 rounded-2xl border border-glass-border bg-white/5 p-4 text-sm text-white/85 open:pb-5">
      <summary className="cursor-pointer font-medium text-brand-yellow">Lihat size chart</summary>
      <div className="mt-4 grid gap-3">
        <div className="overflow-x-auto rounded-xl border border-white/10" tabIndex={0} role="region" aria-label="Tabel size chart jersey, geser ke samping untuk melihat semua kolom">
          <table className="w-full min-w-[560px] text-center">
            <thead>
              <tr className="text-xs text-white/75">
                <th scope="col" className="sticky left-0 bg-green-deep px-3 py-2 text-left font-semibold">Ukuran</th>
                {JERSEY_CHART_COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className="px-2 py-2 font-semibold">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {JERSEY_SIZES.map((s) => (
                <tr key={s} className="border-t border-white/10">
                  <th scope="row" className="sticky left-0 bg-green-deep px-3 py-1.5 text-left font-semibold text-white">{s}</th>
                  {JERSEY_CHART_COLUMNS.map((c) => (
                    <td key={c.key} className="px-2 py-1.5 tabular-nums">{cm(JERSEY_CHART[s][c.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-white/75">Semua ukuran dalam cm. Di layar kecil, geser tabel ke samping untuk melihat semua kolom.</p>
      </div>
    </details>
  );
}

