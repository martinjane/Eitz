import React, { useRef, useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useEditor } from "@/contexts/EditorContext";
import { useAuth } from "@/contexts/AuthContext";
import { EitashotLogo } from "@/components/EitashotLogo";
import { useTheme } from "@/hooks/useTheme";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, Loader2, Pencil, Sparkles, Megaphone, Send } from "lucide-react";
import { DonationProgress } from "@/components/DonationProgress";
import { DonateModal } from "@/components/DonateModal";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

function EitaaIcon({ size = 22 }: { size?: number }) {
  return (
    <img
      src="/eitaa-icon.png"
      width={size}
      height={size}
      alt="Eitaa"
      style={{ borderRadius: size * 0.25, display: "inline-block", verticalAlign: "middle" }}
    />
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadImage } = useEditor();
  const { isDark, toggle: toggleTheme } = useTheme();
  const { auth, login } = useAuth();
  const [showChoiceScreen, setShowChoiceScreen] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const { toast } = useToast();

  // Check if the authenticated user has pending (awaiting payment) ad transactions
  const authToken = auth.status === "authenticated" ? auth.token : null;
  const { data: pendingData } = useQuery<{ hasPending: boolean }>({
    queryKey: ["payments-pending", authToken],
    queryFn: async () => {
      const res = await fetch("/api/payments/pending", {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!res.ok) return { hasPending: false };
      return res.json();
    },
    enabled: !!authToken,
    staleTime: 60_000,
  });
  const hasPendingPayments = pendingData?.hasPending ?? false;

  // Handle return from IDPay donation payment
  useEffect(() => {
    const params = new URLSearchParams(search);
    const payment = params.get("payment");
    if (payment === "donation_success") {
      toast({ title: "کمک مالی با موفقیت ثبت شد 💙", description: "ممنون از حمایت شما!", duration: 5000 });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payment === "donation_failed") {
      toast({ title: "پرداخت ناموفق", description: "پرداخت تکمیل نشد.", variant: "destructive", duration: 5000 });
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("donate") === "1") {
      setShowDonateModal(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [search, toast]);

  const submitFeedback = async () => {
    const message = feedback.trim();
    if (!message || feedbackSending) return;
    setFeedbackSending(true);
    try {
      const authToken = auth.status === "authenticated" ? auth.token : null;
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.message ?? "ارسال بازخورد انجام نشد", variant: "destructive" });
        return;
      }
      setFeedback("");
      toast({ title: "بازخورد شما ثبت شد", description: "ممنون که به بهتر شدن ایتاشات کمک می‌کنید." });
    } catch {
      toast({ title: "ارتباط با سرور برقرار نشد", variant: "destructive" });
    } finally {
      setFeedbackSending(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { loadImage(ev.target?.result as string); setShowChoiceScreen(true); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Auth section ──────────────────────────────────────────────────────────
  const AuthSection = () => {
    if (auth.status === "loading") return (
      <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-muted">
        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
      </div>
    );
    if (auth.status === "authenticated") {
      const displayName = auth.user.username.length > 5
        ? auth.user.username.slice(0, 5) + "…"
        : auth.user.username;
      return (
        <button onClick={() => setLocation("/settings")} className="flex items-center gap-1.5 bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20 px-2.5 py-1.5 rounded-xl text-xs font-bold hover:bg-orange-500/20 transition-colors active:opacity-80">
          <EitaaIcon size={14} />
          <span dir="ltr">@{displayName}</span>
        </button>
      );
    }
    return (
      <button onClick={login} className="flex items-center gap-1.5 bg-[#E05A0C]/10 hover:bg-[#E05A0C]/20 text-[#E05A0C] border border-[#E05A0C]/30 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors active:opacity-80">
        <EitaaIcon size={14} />
        <span>ورود با ایتا</span>
      </button>
    );
  };

  return (
    <div className="min-h-dvh w-full flex flex-col select-none" dir="rtl">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 pt-7 pb-3">
        <div className="flex items-center gap-2.5">
          <EitashotLogo size={30} />
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-foreground">ایتاشات</span>
            <span className="text-[11px] font-medium text-muted-foreground tracking-wide">Eitashot</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mr-3">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setLocation("/advertise")}
            title="تبلیغات"
            className="h-9 w-9 sm:w-auto sm:px-3 flex items-center justify-center sm:gap-1.5 rounded-xl bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:brightness-110 transition-all"
          >
            <Megaphone className="w-5 h-5" strokeWidth={2.5} fill="currentColor" />
            <span className="hidden sm:inline text-xs font-semibold">تبلیغات</span>
          </motion.button>
          <button onClick={toggleTheme} title={isDark ? "حالت روشن" : "حالت تاریک"}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <AuthSection />
        </div>
      </header>

      {/* ── Donation progress — always visible just below header ── */}
      <div className="px-5 pb-1">
        <DonationProgress onDonateClick={() => setShowDonateModal(true)} />
      </div>

      {/* ── Hero — logo + CTA ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-sm space-y-6"
        >
          {/* Logo + name */}
          <div className="flex flex-col items-center gap-4">
            <EitashotLogo size={80} />
            <div>
              <h1 className="text-3xl font-bold text-foreground">ایتاشات</h1>
              <p className="text-sm font-medium text-muted-foreground mt-0.5">Eitashot</p>
            </div>
            <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
              سریع‌ترین راه آماده‌سازی تصویر برای کانال‌ها و شبکه‌های اجتماعی
            </p>
          </div>

          {/* Select image + settings/guide */}
          <div className="space-y-2.5">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
            <div className="flex items-stretch gap-2">
              <motion.button whileTap={{ scale: 0.94 }} onClick={() => setLocation("/settings")} title="تنظیمات"
                className="relative w-14 h-14 shrink-0 flex items-center justify-center bg-card border border-border rounded-2xl text-muted-foreground hover:text-foreground active:opacity-80 transition-opacity">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                {hasPendingPayments && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-card" />
                )}
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => fileInputRef.current?.click()}
                className="flex-1 h-14 bg-primary text-white font-bold text-lg rounded-2xl shadow-md active:opacity-90 transition-opacity">
                انتخاب تصویر
              </motion.button>
              <motion.button whileTap={{ scale: 0.94 }} onClick={() => setLocation("/guide")} title="راهنما"
                className="w-14 h-14 shrink-0 flex items-center justify-center bg-card border border-border rounded-2xl text-muted-foreground hover:text-foreground active:opacity-80 transition-opacity">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
              </motion.button>
            </div>
            <p className="text-xs text-muted-foreground">PNG، JPG، WEBP پشتیبانی می‌شود</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 text-right space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">بازخورد یا گزارش مشکل</h2>
              <span className="text-[10px] text-muted-foreground">{feedback.length}/۲۰۰</span>
            </div>
            <textarea
              value={feedback}
              maxLength={200}
              onChange={e => setFeedback(e.target.value)}
              placeholder="نظر یا مشکلی که با آن روبه‌رو شدید..."
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <button
              onClick={submitFeedback}
              disabled={!feedback.trim() || feedbackSending}
              className="w-full h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {feedbackSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              ارسال بازخورد
            </button>
          </div>
        </motion.div>
      </div>

      {/* Post-select choice overlay */}
      <AnimatePresence>
        {showChoiceScreen && (
          <motion.div key="backdrop" className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div key="card" className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-xl p-7 space-y-5 text-center"
              initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground">چه کاری می‌خواهید انجام دهید؟</h2>
                <p className="text-sm text-muted-foreground">تصویر شما آماده است</p>
              </div>
              <div className="space-y-3">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setShowChoiceScreen(false); setLocation("/editor"); }}
                  className="w-full h-14 bg-primary text-white font-bold text-base rounded-2xl shadow-md flex items-center justify-center gap-2">
                  <Pencil className="w-4 h-4" /> ویرایش تصویر
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setShowChoiceScreen(false); setLocation("/saved-styles"); }}
                  className="w-full h-14 bg-accent text-accent-foreground font-bold text-base rounded-2xl shadow-md flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" /> استفاده از استایل ذخیره‌شده
                </motion.button>
              </div>
              <button onClick={() => setShowChoiceScreen(false)} className="text-xs text-muted-foreground underline">انصراف</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DonateModal open={showDonateModal} onClose={() => setShowDonateModal(false)} />
    </div>
  );
}
