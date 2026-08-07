import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, X, Check, Loader2, Image as ImageIcon,
  ExternalLink, CheckSquare, Square, Settings, Megaphone,
} from "lucide-react";
import { formatJalaliDate, slotLabel, toPersianNumber } from "@/lib/jalali";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SlotInfo { slot: number; available: boolean; }
interface DaySlots { date: string; slots: SlotInfo[]; }
interface SlotsResponse { days: DaySlots[]; windowPriceTomans: number; }
interface SelectedWindow { date: string; slot: number; }

interface SavedAd {
  id: number;
  channelLink: string;
  channelName: string;
  adText: string;
  adImage: string;
  status: string;
  reviewNote?: string | null;
  createdAt: string;
}

// "pick_ad" replaces the old "form" step — user selects a pre-created, approved ad
type Step = "terms" | "pick_ad" | "schedule" | "review" | "paying";

// Helper: render ad text with **bold** markers
function renderBoldText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TERMS = `
۱. آگهی‌دهنده مسئولیت کامل محتوای کانال تبلیغ‌شده را می‌پذیرد.

۲. آگهی‌دهنده باید دارای حق قانونی برای تبلیغ کانال باشد.

۳. تبلیغات باید با قوانین جمهوری اسلامی ایران مطابقت داشته باشد.

۴. آگهی‌دهنده متعهد به ارائه اطلاعات تماس صحیح در صورت درخواست می‌شود.

۵. تمام آگهی‌ها پیش از انتشار توسط تیم اجرایی بررسی می‌شوند و تأیید آگهی تضمین نمی‌شود.

۶. آگهی‌های تأیید نشده منتشر نخواهند شد.

۷. نقض قوانین می‌تواند منجر به حذف آگهی شود.

۸. فقط کانال‌های ایتا قابل تبلیغ هستند. تبلیغ وب‌سایت، شبکه‌های اجتماعی دیگر، محصول یا کسب‌وکار پذیرفته نمی‌شود.
`.trim();

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdvertisePage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const paymentStatus = params.get("payment");

  const { auth, getToken } = useAuth();

  const [step, setStep] = useState<Step>("terms");

  // Selected saved ad
  const [selectedAd, setSelectedAd] = useState<SavedAd | null>(null);

  // Schedule
  const [selectedWindows, setSelectedWindows] = useState<SelectedWindow[]>([]);

  // Submission
  const [adId, setAdId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Ad terms: track whether we're saving acceptance to the API
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const { data: maintenanceData, isLoading: maintenanceLoading } = useQuery<{ disabled: boolean }>({
    queryKey: ["ad-maintenance"],
    queryFn: async () => {
      const res = await fetch("/api/ads/maintenance");
      if (!res.ok) throw new Error("maintenance_check_failed");
      return res.json();
    },
    staleTime: 15_000,
  });

  const didReturn = paymentStatus === "success" || paymentStatus === "failed";

  // ── Ad Terms acceptance ────────────────────────────────────────────────────
  const token = auth.status === "authenticated" ? auth.token : null;

  const { data: adTermsData } = useQuery<{ accepted: boolean }>({
    queryKey: ["ad-terms", token],
    queryFn: async () => {
      const res = await fetch("/api/ads/ad-terms", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { accepted: false };
      return res.json() as Promise<{ accepted: boolean }>;
    },
    enabled: !!token,
    staleTime: Infinity, // acceptance doesn't change during a session
  });

  // If the user has already accepted, jump straight past the terms step
  useEffect(() => {
    if (adTermsData?.accepted && step === "terms") {
      setStep("pick_ad");
    }
  }, [adTermsData, step]);

  // ── Fetch user's content-approved saved ads ────────────────────────────────
  const { data: savedAdsData, isLoading: savedAdsLoading } = useQuery<{ ads: SavedAd[] }>({
    queryKey: ["my-saved-ads"],
    queryFn: async () => {
      const res = await fetch("/api/ads/mine", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
    enabled: step === "pick_ad" && !!token,
    staleTime: 60_000,
  });

  const approvedSavedAds = (savedAdsData?.ads ?? []).filter(a => a.status === "content_approved");

  // ── Slot availability ──────────────────────────────────────────────────────
  const { data: slotsData, isLoading: slotsLoading } = useQuery<SlotsResponse>({
    queryKey: ["ad-slots"],
    queryFn: async () => {
      const res = await fetch("/api/ads/slots");
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
    staleTime: 30_000,
    enabled: step === "schedule",
  });

  if (!maintenanceLoading && maintenanceData?.disabled) {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center p-6 bg-background" dir="rtl">
        <div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-xl p-8 text-center space-y-5">
          <div className="w-16 h-16 mx-auto bg-amber-500/10 rounded-2xl flex items-center justify-center">
            <Megaphone className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-lg font-bold text-foreground">تبلیغات موقتاً در دسترس نیست</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            بخش تبلیغات موقتاً در دسترس نیست. در حال آماده‌سازی و اطمینان از نمایش مطمئن تبلیغات بدون مشکل هستیم.
          </p>
          <button onClick={() => setLocation("/")} className="w-full h-12 bg-primary text-white font-bold rounded-2xl">
            بازگشت به صفحه اصلی
          </button>
        </div>
      </div>
    );
  }

  // ── Window toggle ──────────────────────────────────────────────────────────
  function toggleWindow(date: string, slot: number) {
    setSelectedWindows(prev => {
      const exists = prev.some(w => w.date === date && w.slot === slot);
      if (exists) return prev.filter(w => !(w.date === date && w.slot === slot));
      return [...prev, { date, slot }];
    });
  }

  function isSelected(date: string, slot: number) {
    return selectedWindows.some(w => w.date === date && w.slot === slot);
  }

  // ── Submit (schedule selected saved ad) ────────────────────────────────────
  async function handleSubmit() {
    if (!selectedAd) { setSubmitError("یک آگهی انتخاب کنید"); return; }
    if (selectedWindows.length === 0) { setSubmitError("حداقل یک بازه زمانی انتخاب کنید"); return; }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/ads/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ savedAdId: selectedAd.id, windows: selectedWindows }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.message ?? "خطا در ثبت آگهی"); setSubmitting(false); return; }
      setAdId(data.adId);
      setStep("review");
    } catch {
      setSubmitError("ارتباط با سرور برقرار نشد");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Pay ────────────────────────────────────────────────────────────────────
  async function handlePay() {
    if (!adId) return;
    setPayError(null);
    setPaying(true);
    try {
      const res = await fetch(`/api/ads/pay/${adId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // Windows are sent here so reservation happens atomically at payment time
        body: JSON.stringify({ windows: selectedWindows }),
      });
      const data = await res.json();
      if (!res.ok) { setPayError(data.message ?? "خطا در راه‌اندازی پرداخت"); setPaying(false); return; }
      window.location.href = data.paymentUrl;
    } catch {
      setPayError("ارتباط با سرور برقرار نشد");
      setPaying(false);
    }
  }

  const pricePerWindow = slotsData?.windowPriceTomans ?? 50_000;
  const totalPrice = selectedWindows.length * pricePerWindow;

  // ── Return from IDPay ──────────────────────────────────────────────────────
  if (didReturn) {
    return (
      <div className="min-h-dvh w-full flex flex-col items-center justify-center p-6 bg-background" dir="rtl">
        <motion.div
          className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-xl p-8 text-center space-y-5"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {paymentStatus === "success" ? (
            <>
              <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-2xl flex items-center justify-center">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground">پرداخت موفق</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  آگهی شما با موفقیت ثبت شد و در صف بررسی قرار گرفت. پس از تأیید، در بازه‌های انتخابی نمایش داده می‌شود.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-2xl flex items-center justify-center">
                <X className="w-8 h-8 text-destructive" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground">پرداخت ناموفق</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  پرداخت تکمیل نشد. رزرو بازه‌های زمانی شما منقضی شده است. می‌توانید دوباره اقدام کنید.
                </p>
              </div>
            </>
          )}
          <button
            onClick={() => setLocation("/")}
            className="w-full h-12 bg-primary text-white font-bold rounded-2xl text-sm transition-opacity active:opacity-80"
          >
            بازگشت به صفحه اصلی
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Steps ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh w-full flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-7 pb-3">
        <button
          onClick={() => {
            if (step === "terms") setLocation("/");
            else if (step === "pick_ad") {
              if (adTermsData?.accepted) setLocation("/");
              else setStep("terms");
            }
            else if (step === "schedule") setStep("pick_ad");
            else if (step === "review") setStep("schedule");
          }}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-bold text-foreground">تبلیغات در ایتاشات</h1>
          <p className="text-xs text-muted-foreground">
            {step === "terms" && "مطالعه و پذیرش شرایط"}
            {step === "pick_ad" && "انتخاب آگهی"}
            {step === "schedule" && "انتخاب بازه زمانی"}
            {step === "review" && "بررسی و پرداخت"}
          </p>
        </div>
      </header>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 py-3">
        {(["terms", "pick_ad", "schedule", "review"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all ${
              s === step
                ? "w-6 bg-primary"
                : ["terms", "pick_ad", "schedule", "review"].indexOf(step) > i
                ? "w-2 bg-primary/40"
                : "w-2 bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Terms ── */}
          {step === "terms" && (
            <motion.div key="terms" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 pt-2">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h2 className="font-bold text-foreground">سیستم تبلیغات ایتاشات</h2>
                <p className="text-sm text-muted-foreground leading-7">
                  ایتاشات امکان تبلیغ <strong>کانال‌های ایتا</strong> را برای کاربران فراهم می‌کند.
                  آگهی شما در قالب یک اعلان در اپلیکیشن نمایش داده می‌شود. پیش از ادامه، شرایط استفاده را مطالعه فرمایید.
                </p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h3 className="font-semibold text-foreground text-sm">شرایط و قوانین</h3>
                <div className="select-none text-sm text-muted-foreground leading-8 whitespace-pre-line">{TERMS}</div>
              </div>
              <button
                onClick={async () => {
                  // Save acceptance to the backend (idempotent) so future visits
                  // skip this step automatically. Proceed even if the request fails.
                  if (token) {
                    setAcceptingTerms(true);
                    try {
                      await fetch("/api/ads/ad-terms", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                    } catch { /* ignore network errors — still advance */ }
                    setAcceptingTerms(false);
                  }
                  setStep("pick_ad");
                }}
                disabled={acceptingTerms}
                className="w-full h-13 bg-primary text-white font-bold rounded-2xl text-sm py-3 transition-opacity active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acceptingTerms
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : "شرایط را می‌پذیرم و ادامه می‌دهم"}
              </button>
            </motion.div>
          )}

          {/* ── Step 2: Pick approved saved ad ── */}
          {step === "pick_ad" && (
            <motion.div key="pick_ad" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 pt-2">

              {!token ? (
                <div className="bg-muted/40 border border-border rounded-2xl p-5 text-center text-sm text-muted-foreground">
                  برای تبلیغ باید وارد حساب کاربری شوید.
                </div>
              ) : savedAdsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : approvedSavedAds.length === 0 ? (
                <div className="bg-muted/40 border border-border rounded-2xl p-6 text-center space-y-3">
                  <Megaphone className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">آگهی تأیید‌شده‌ای ندارید</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      ابتدا باید یک آگهی در تنظیمات ایجاد کنید و منتظر تأیید ادمین بمانید.
                    </p>
                  </div>
                  <button
                    onClick={() => setLocation("/settings")}
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    رفتن به تنظیمات
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">یک آگهی تأیید‌شده انتخاب کنید:</p>
                  <div className="space-y-2">
                    {approvedSavedAds.map(ad => {
                      const isSelected = selectedAd?.id === ad.id;
                      return (
                        <button
                          key={ad.id}
                          onClick={() => setSelectedAd(ad)}
                          className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-right transition-colors ${
                            isSelected ? "bg-primary/8 border-primary" : "bg-card border-border hover:border-primary/30"
                          }`}
                        >
                          <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected ? "border-primary bg-primary" : "border-border"
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          {ad.adImage && (
                            <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-muted">
                              <img src={ad.adImage} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 text-right">
                            <p className="font-semibold text-sm text-foreground leading-tight truncate">{ad.channelName}</p>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{ad.adText.replace(/\*\*/g, "")}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {submitError && step === "pick_ad" && (
                <p className="text-xs text-destructive text-center">{submitError}</p>
              )}

              {approvedSavedAds.length > 0 && (
                <button
                  onClick={() => {
                    if (!selectedAd) { setSubmitError("یک آگهی انتخاب کنید"); return; }
                    setSubmitError(null);
                    setSelectedWindows([]);
                    setStep("schedule");
                  }}
                  disabled={!selectedAd}
                  className="w-full h-12 bg-primary text-white font-bold rounded-2xl text-sm transition-opacity active:opacity-80 disabled:opacity-40"
                >
                  ادامه — انتخاب بازه زمانی
                </button>
              )}
            </motion.div>
          )}

          {/* ── Step 3: Schedule ── */}
          {step === "schedule" && (
            <motion.div key="schedule" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 pt-2">
              <div className="bg-muted/40 border border-border rounded-2xl p-4 text-sm text-muted-foreground space-y-1">
                <p>بازه‌های مورد نظر خود را انتخاب کنید.</p>
                <p>هر بازه: <strong className="text-foreground">{toPersianNumber(slotsData?.windowPriceTomans ?? 50_000)} تومان</strong></p>
              </div>

              {slotsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-4">
                  {slotsData?.days.map(day => (
                    <div key={day.date} className="space-y-2">
                      <p className="font-semibold text-sm text-foreground">{formatJalaliDate(day.date)}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {day.slots.map(slotInfo => {
                          const selected = isSelected(day.date, slotInfo.slot);
                          return (
                            <button
                              key={slotInfo.slot}
                              disabled={!slotInfo.available}
                              onClick={() => toggleWindow(day.date, slotInfo.slot)}
                              className={`h-12 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                                !slotInfo.available
                                  ? "border-border/50 text-muted-foreground/40 bg-muted/30 cursor-not-allowed line-through"
                                  : selected
                                  ? "bg-primary text-white border-primary"
                                  : "border-border text-foreground hover:border-primary/40 bg-card"
                              }`}
                            >
                              {selected ? <CheckSquare className="w-3.5 h-3.5 shrink-0" /> : <Square className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                              {slotLabel(slotInfo.slot)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedWindows.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{toPersianNumber(selectedWindows.length)} بازه انتخاب‌شده</span>
                    <span className="font-bold text-foreground">{toPersianNumber(totalPrice)} تومان</span>
                  </div>
                </div>
              )}

              {submitError && step === "schedule" && (
                <p className="text-xs text-destructive text-center">{submitError}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || selectedWindows.length === 0}
                className="w-full h-12 bg-primary text-white font-bold rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity active:opacity-80"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "ادامه — بررسی سفارش"}
              </button>
            </motion.div>
          )}

          {/* ── Step 4: Review & Pay ── */}
          {step === "review" && selectedAd && (
            <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 pt-2">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-foreground">بررسی آگهی</h3>
                <AdPreview channelName={selectedAd.channelName} adText={selectedAd.adText} adImage={selectedAd.adImage} showLink channelLink={selectedAd.channelLink} />
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h3 className="font-semibold text-foreground text-sm">بازه‌های انتخاب‌شده</h3>
                <div className="space-y-2">
                  {selectedWindows.map(w => (
                    <div key={`${w.date}-${w.slot}`} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{formatJalaliDate(w.date)} — {slotLabel(w.slot)}</span>
                      <span className="font-medium text-foreground">{toPersianNumber(pricePerWindow)} تومان</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between font-bold">
                    <span className="text-foreground">جمع کل</span>
                    <span className="text-foreground">{toPersianNumber(totalPrice)} تومان</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 text-xs text-muted-foreground leading-6">
                بازه‌های زمانی هنگام شروع پرداخت رزرو می‌شوند. در صورتی که بازه‌ای در همین لحظه توسط کاربر دیگری رزرو شود، پیام مناسب دریافت خواهید کرد.
              </div>

              {payError && <p className="text-xs text-destructive text-center">{payError}</p>}

              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full h-12 bg-primary text-white font-bold rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity active:opacity-80"
              >
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : `پرداخت ${toPersianNumber(totalPrice)} تومان`}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Ad preview card ────────────────────────────────────────────────────────────

function AdPreview({
  channelName,
  adText,
  adImage,
  showLink,
  channelLink,
}: {
  channelName: string;
  adText: string;
  adImage: string | null;
  showLink?: boolean;
  channelLink?: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-background border border-border rounded-2xl p-3 shadow-sm" dir="rtl">
      <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
        {adImage ? (
          <img src={adImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-bold text-sm text-foreground truncate leading-tight">{channelName}</p>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{renderBoldText(adText)}</p>
        {showLink && channelLink && (
          <a
            href={channelLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary font-medium"
          >
            مشاهده کانال
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}
