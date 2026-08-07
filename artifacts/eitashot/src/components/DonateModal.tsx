import { useState } from "react";
import { X, Heart, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { toPersianNumber } from "@/lib/jalali";

const DEFAULT_PRESETS = [10_000, 30_000, 50_000, 100_000];

interface DonateModalProps {
  open: boolean;
  onClose: () => void;
}

export function DonateModal({ open, onClose }: DonateModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load dynamic presets from API
  const { data: pricingData } = useQuery({
    queryKey: ["pricing"],
    queryFn: async () => {
      const res = await fetch("/api/pricing");
      if (!res.ok) return null;
      return res.json() as Promise<{ pricing: { donation_presets: number[] } }>;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const presets: number[] = pricingData?.pricing?.donation_presets ?? DEFAULT_PRESETS;

  function effectiveAmount(): number | null {
    if (selectedAmount !== null) return selectedAmount;
    const n = Number(customAmount.replace(/[^0-9]/g, ""));
    return n > 0 ? n : null;
  }

  async function handlePay() {
    const amount = effectiveAmount();
    if (!amount || amount < 1000) { setError("حداقل مبلغ کمک ۱٬۰۰۰ تومان است"); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/donation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountTomans: amount }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "خطایی رخ داد"); setLoading(false); return; }
      window.location.href = data.paymentUrl;
    } catch {
      setError("ارتباط با سرور برقرار نشد");
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}>
          <motion.div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-xl p-6 space-y-5"
            initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary/10">
                  <Heart className="w-4 h-4 text-primary fill-primary/30" />
                </div>
                <span className="font-bold text-foreground">کمک مالی</span>
              </div>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-6">مبلغ دلخواه خود را برای کمک به هزینه‌های نگهداری سرویس انتخاب کنید.</p>

            {/* Dynamic presets */}
            <div className="grid grid-cols-2 gap-2">
              {presets.map((amount) => (
                <button key={amount} onClick={() => { setSelectedAmount(amount); setCustomAmount(""); setError(null); }}
                  className={`h-11 rounded-2xl border font-semibold text-sm transition-colors ${selectedAmount === amount ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground hover:border-primary/40"}`}>
                  {toPersianNumber(amount)} تومان
                </button>
              ))}
            </div>

            <input type="number" placeholder="مبلغ دلخواه (تومان)" value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); setError(null); }}
              className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-right" dir="ltr" />

            {error && <p className="text-xs text-destructive text-center">{error}</p>}

            <button onClick={handlePay} disabled={loading || !effectiveAmount()}
              className="w-full h-12 bg-primary text-white font-bold rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity active:opacity-80">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `پرداخت ${effectiveAmount() ? toPersianNumber(effectiveAmount()!) + " تومان" : ""}`}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
