import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, User, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ── Username validation helpers ───────────────────────────────────────────────
const REGEX = /^[a-z0-9_]{3,16}$/;

function formatHint(username: string): string | null {
  if (!username) return null;
  if (username.length < 3) return "حداقل ۳ کاراکتر";
  if (username.length > 16) return "حداکثر ۱۶ کاراکتر";
  if (!/^[a-z0-9_]+$/.test(username)) return "فقط حروف انگلیسی کوچک، اعداد و زیرخط (_)";
  return null;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

// ── Terms of Service text ─────────────────────────────────────────────────────
const TOS_SECTIONS = [
  {
    title: "۱. سرویس",
    body: "ایتاشات یک ابزار ویرایش تصویر آنلاین است که امکان ویرایش، تنظیم و ذخیره تصاویر را فراهم می‌کند. استفاده از این سرویس به‌منزله پذیرش کامل این شرایط است.",
  },
  {
    title: "۲. شرایط سنی",
    body: "استفاده از ایتاشات مستلزم داشتن حداقل ۱۸ سال سن یا اجازه صریح ولی قانونی است.",
  },
  {
    title: "۳. محتوای کاربر",
    body: "مسئولیت تمام تصاویر و محتوای آپلودشده بر عهده کاربر است. آپلود محتوای غیرقانونی، مبتذل، توهین‌آمیز یا ناقض حقوق مالکیت معنوی دیگران کاملاً ممنوع است.",
  },
  {
    title: "۴. پرداخت‌ها",
    body: "پرداخت‌های تبلیغاتی و کمک‌های مالی از طریق درگاه IDPay پردازش می‌شوند. کلیه تراکنش‌ها قطعی و غیرقابل برگشت‌اند مگر در موارد خطای فنی اثبات‌شده.",
  },
  {
    title: "۵. حریم خصوصی",
    body: "اطلاعات حساب کاربری از طریق اپلیکیشن ایتا دریافت می‌شود. داده‌های شما برای بهبود سرویس استفاده می‌شود و هرگز به اشخاص ثالث فروخته نمی‌شود.",
  },
  {
    title: "۶. سلب مسئولیت",
    body: "سرویس «به همان شکل موجود» ارائه می‌شود. ایتاشات هیچ مسئولیتی در قبال از دست رفتن داده، وقفه در سرویس یا خسارت ناشی از استفاده نمی‌پذیرد.",
  },
  {
    title: "۷. تغییرات شرایط",
    body: "ایتاشات حق به‌روزرسانی این شرایط را در آینده محفوظ می‌دارد. ادامه استفاده پس از انتشار تغییرات به‌منزله پذیرش آن‌هاست.",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function UsernameModal() {
  const { auth, completeSignup } = useAuth();

  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [tosExpanded, setTosExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (auth.status !== "needs_username") return null;

  const { eitaaUser } = auth;
  const displayName =
    [eitaaUser.firstName, eitaaUser.lastName].filter(Boolean).join(" ") ||
    `کاربر #${eitaaUser.id}`;

  // ── Debounced availability check ──────────────────────────────────────────
  const checkAvailability = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!REGEX.test(value)) {
      setAvailability(formatHint(value) ? "invalid" : "idle");
      return;
    }
    setAvailability("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/check-username/${encodeURIComponent(value)}`);
        if (!res.ok) { setAvailability("idle"); return; }
        const data = await res.json() as { available: boolean };
        setAvailability(data.available ? "available" : "taken");
      } catch {
        setAvailability("idle");
      }
    }, 450);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim().toLowerCase();
    setUsername(val);
    setServerError(null);
    checkAvailability(val);
  };

  const canSubmit = availability === "available" && !submitting && tosAccepted;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);
    const result = await completeSignup(username, true);
    if (!result.ok) {
      setServerError(result.error ?? "خطای ناشناخته");
      checkAvailability(username);
    }
    setSubmitting(false);
  };

  // ── Status indicator ──────────────────────────────────────────────────────
  const hint = formatHint(username);
  const showOk   = availability === "available" && !hint;
  const showBad  = availability === "taken" || (username.length > 0 && hint !== null);
  const showSpin = availability === "checking";

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-5 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        dir="rtl"
      >
        <motion.div
          key="card"
          className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-xl p-7 space-y-5 my-auto"
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <User className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">انتخاب نام کاربری</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              خوش آمدی، <span className="font-semibold text-foreground">{displayName}</span>!
              <br />
              یک نام کاربری منحصربه‌فرد برای حساب ایتاشات خود انتخاب کن.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="username-input">
                نام کاربری
              </label>
              <div className="relative">
                <input
                  id="username-input"
                  type="text"
                  value={username}
                  onChange={handleChange}
                  placeholder="مثال: ali_photo"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  dir="ltr"
                  maxLength={16}
                  className="w-full h-12 rounded-xl border border-border bg-background px-4 pr-10 text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2">
                  {showSpin && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                  {showOk   && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {showBad  && <XCircle className="w-4 h-4 text-destructive" />}
                </span>
              </div>

              <AnimatePresence mode="wait">
                {(hint || availability === "taken" || serverError) && (
                  <motion.p
                    key={hint ?? availability ?? serverError}
                    className="text-xs text-destructive"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {serverError ?? (availability === "taken" ? "این نام کاربری قبلاً گرفته شده" : hint)}
                  </motion.p>
                )}
                {showOk && !hint && !serverError && (
                  <motion.p
                    key="ok"
                    className="text-xs text-green-600"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    این نام کاربری موجود است ✓
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Rules */}
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>۳ تا ۱۶ کاراکتر</li>
              <li>حروف انگلیسی کوچک (a–z)، اعداد (0–9) یا زیرخط (_)</li>
              <li>حروف بزرگ به‌طور خودکار کوچک می‌شوند</li>
            </ul>

            {/* Terms of Service */}
            <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
              {/* ToS header / toggle */}
              <button
                type="button"
                onClick={() => setTosExpanded(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs font-semibold text-foreground">شرایط استفاده از ایتاشات</span>
                {tosExpanded
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
              </button>

              {/* ToS body */}
              <AnimatePresence>
                {tosExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-3 max-h-52 overflow-y-auto text-xs text-muted-foreground leading-6 border-t border-border">
                      {TOS_SECTIONS.map((s) => (
                        <div key={s.title}>
                          <p className="font-semibold text-foreground">{s.title}</p>
                          <p>{s.body}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Acceptance checkbox */}
              <button
                type="button"
                onClick={() => setTosAccepted(p => !p)}
                className="w-full flex items-center gap-3 px-4 py-3 border-t border-border text-right hover:bg-muted/50 transition-colors"
              >
                <div className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${tosAccepted ? "bg-primary border-primary" : "border-border bg-background"}`}>
                  {tosAccepted && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-foreground flex-1">
                  شرایط استفاده را خواندم و می‌پذیرم
                </span>
              </button>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={!canSubmit}
              whileTap={{ scale: 0.97 }}
              className="w-full h-12 bg-primary text-white font-bold rounded-xl shadow-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> در حال ثبت…</>
                : "ثبت و ورود"}
            </motion.button>
          </form>

          <p className="text-center text-xs text-muted-foreground/70">
            می‌توانی بدون ثبت‌نام هم از برنامه استفاده کنی
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
