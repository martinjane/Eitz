import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Heart, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toPersianNumber } from "@/lib/jalali";

interface ProgressData {
  donatedTomans: number;
  targetTomans: number;
  percentage: number;
}

async function fetchProgress(): Promise<ProgressData> {
  const res = await fetch("/api/donation/progress");
  if (!res.ok) throw new Error("fetch failed");
  return res.json();
}

interface DonationProgressProps {
  onDonateClick?: () => void;
}

export function DonationProgress({ onDonateClick }: DonationProgressProps) {
  const [showInfo, setShowInfo] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["donation-progress"],
    queryFn: fetchProgress,
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading || !data) return null;

  const { donatedTomans, targetTomans, percentage } = data;
  const isOverfunded = percentage > 100;
  const barWidth = Math.min(100, percentage);

  return (
    <>
      <div className="w-full space-y-2" dir="rtl">
        {/* Label row */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowInfo(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/15 active:bg-primary/20 transition-colors"
          >
            <Heart className="w-3 h-3 fill-primary" />
            <span>هزینه زیرساخت</span>
            <ChevronLeft className="w-3 h-3 opacity-60" />
          </button>
          <span className={`text-xs font-bold tabular-nums ${isOverfunded ? "text-green-600 dark:text-green-400" : "text-primary"}`}>
            {isOverfunded ? "🎉 " : ""}{toPersianNumber(percentage)}٪
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
          <motion.div
            className={`absolute inset-y-0 right-0 rounded-full ${isOverfunded ? "bg-gradient-to-l from-green-500 to-green-400" : "bg-gradient-to-l from-primary to-primary/60"}`}
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          {isOverfunded ? (
            <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">
              هدف تکمیل شد! {toPersianNumber(donatedTomans - targetTomans)} تومان اضافه 🙏
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {toPersianNumber(donatedTomans)} از {toPersianNumber(targetTomans)} تومان
            </span>
          )}
          {!isOverfunded && (
            <button
              onClick={onDonateClick}
              className="text-[11px] font-bold text-primary bg-primary/8 hover:bg-primary/15 px-2.5 py-0.5 rounded-full transition-colors"
            >
              کمک کنید ←
            </button>
          )}
        </div>
      </div>

      {/* Info modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-xl p-6 space-y-4"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary/10">
                    <Heart className="w-4 h-4 text-primary fill-primary/30" />
                  </div>
                  <span className="font-bold text-foreground">درباره هزینه‌های سرویس</span>
                </div>
                <button
                  onClick={() => setShowInfo(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground leading-7">
                برای فعال ماندن این سرویس، هر ۳۰ روز حدود {toPersianNumber(targetTomans)} تومان هزینه
                زیرساخت پرداخت می‌شود. این نوار میزان کمک‌های همین دوره را نشان
                می‌دهد. اگر این مبلغ تکمیل نشود، باقی هزینه توسط توسعه‌دهنده
                پرداخت می‌شود. اگر این پروژه برایتان مفید بوده، حتی کمک‌های
                کوچک نیز تأثیر بزرگی دارند.
              </p>

              <button
                onClick={() => {
                  setShowInfo(false);
                  onDonateClick?.();
                }}
                className="w-full h-11 bg-primary text-white font-bold rounded-2xl text-sm transition-opacity active:opacity-80"
              >
                💙 کمک مالی
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
