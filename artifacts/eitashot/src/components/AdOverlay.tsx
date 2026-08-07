import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Megaphone, Heart, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";

function renderBoldText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

interface AdData {
  channelLink: string;
  channelName: string;
  adText: string;
  adImage: string;
}

type OverlayContent =
  | { kind: "ad"; ad: AdData }
  | { kind: "promo" }
  | { kind: "donation_promo" }
  | { kind: "empty" };

async function fetchOverlayContent(): Promise<OverlayContent> {
  try {
    const res = await fetch("/api/ads/current");
    if (!res.ok) return { kind: "promo" };
    const data = await res.json() as { ad: AdData | null; defaultKind?: "promo" | "donation_promo" };
    if (data.ad) return { kind: "ad", ad: data.ad };
    if (data.defaultKind === "donation_promo") return { kind: "donation_promo" };
    return { kind: "promo" };
  } catch {
    return { kind: "empty" };
  }
}

export function AdOverlay() {
  const [visible, setVisible] = useState(false);
  const [content, setContent] = useState<OverlayContent>({ kind: "empty" });
  const [location, setLocation] = useLocation();

  // Use a ref for the hide timer so we can pause/resume it from AdCard
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = useCallback((delayMs: number) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), delayMs);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const navigateBuiltIn = useCallback((destination: string) => {
    const isWorking = location.startsWith("/editor") || location.startsWith("/saved-styles");
    if (isWorking && !window.confirm("برای باز کردن این بخش، صفحه فعلی را ترک می‌کنید. ادامه می‌دهید؟")) return;
    setVisible(false);
    setLocation(destination);
  }, [location, setLocation]);

  useEffect(() => {
    let repeatInterval: ReturnType<typeof setInterval>;

    const show = async () => {
      try {
        const c = await fetchOverlayContent();
        if (c.kind === "empty") return;
        setContent(c);
        setVisible(true);
        // Ads: 5 s; promo: 8 s
        scheduleHide(c.kind === "ad" ? 5_000 : 8_000);
      } catch {
        // never disrupt the main UX
      }
    };

    // First display after 15 s; repeat every 90 s
    const firstTimer = setTimeout(() => {
      show();
      repeatInterval = setInterval(show, 90_000);
    }, 15_000);

    return () => {
      clearTimeout(firstTimer);
      cancelHide();
      clearInterval(repeatInterval);
    };
  }, [scheduleHide, cancelHide]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-4 right-4 left-4 z-40 flex justify-center pointer-events-none"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
        >
          <div className="w-full max-w-sm pointer-events-auto" dir="rtl">
            {content.kind === "ad" ? (
              <AdCard
                key={content.ad.channelLink}
                ad={content.ad}
                onDismiss={() => setVisible(false)}
                onExpand={cancelHide}
                onCollapse={() => scheduleHide(3_000)}
              />
            ) : content.kind === "promo" ? (
              <PromoCard
                onDismiss={() => setVisible(false)}
                onNavigate={() => navigateBuiltIn("/advertise")}
              />
            ) : content.kind === "donation_promo" ? (
              <DonationPromoCard
                onDismiss={() => setVisible(false)}
                onNavigate={() => navigateBuiltIn("/?donate=1")}
                onExpand={cancelHide}
                onCollapse={() => scheduleHide(3_000)}
              />
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Real ad card ──────────────────────────────────────────────────────────────

function AdCard({
  ad,
  onDismiss,
  onExpand,
  onCollapse,
}: {
  ad: AdData;
  onDismiss: () => void;
  /** Called when the user expands the text — pauses the auto-dismiss timer. */
  onExpand: () => void;
  /** Called when the user collapses the text — restarts the auto-dismiss timer. */
  onCollapse: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // After the text renders with line-clamp-2, check whether any content was
  // clipped. If scrollHeight > clientHeight the text overflows the 2-line cap.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    setNeedsExpand(el.scrollHeight > el.clientHeight + 1);
  }, [ad.adText]);

  const handleExpand = () => {
    setExpanded(true);
    onExpand();
  };

  const handleCollapse = () => {
    setExpanded(false);
    onCollapse();
  };

  return (
    <div className="flex items-start gap-3 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-3 select-none">
      {/* Square image */}
      <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-muted">
        <img src={ad.adImage} alt={ad.channelName} className="w-full h-full object-cover" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start justify-between gap-1">
          <p className="font-bold text-sm text-foreground leading-tight truncate">{ad.channelName}</p>
          <button
            onClick={onDismiss}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Ad text — clamped to 2 lines unless the user expands it */}
        <p
          ref={textRef}
          className={`text-xs text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}
        >
          {renderBoldText(ad.adText)}
        </p>

        {/* Expand / collapse button — only shown when text overflows */}
        {needsExpand && (
          <button
            onClick={expanded ? handleCollapse : handleExpand}
            className="flex items-center gap-0.5 text-[11px] text-primary/80 hover:text-primary font-medium transition-colors"
          >
            {expanded ? (
              <>کمتر <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>بیشتر <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}

        <a
          href={ad.channelLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary font-medium mt-1"
        >
          مشاهده کانال
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}

// ── "No ad running — advertise your channel" promo card ───────────────────────

function PromoCard({
  onDismiss,
  onNavigate,
}: {
  onDismiss: () => void;
  onNavigate: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-3 cursor-pointer active:opacity-80 transition-opacity select-none"
      onClick={onNavigate}
      role="button"
    >
      {/* Megaphone icon */}
      <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
        <Megaphone className="w-6 h-6 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs text-muted-foreground leading-snug">این چیه؟</p>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-snug">میتونست تبلیغ کانال تو باشه!</p>
        <p className="text-sm font-bold text-foreground leading-snug">هنوز هم میتونه!</p>
        <p className="text-[11px] text-primary leading-snug">برای اطلاعات بیشتر روی تبلیغات بزن</p>
      </div>
    </div>
  );
}

function DonationPromoCard({
  onDismiss, onNavigate, onExpand, onCollapse,
}: {
  onDismiss: () => void;
  onNavigate: () => void;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex items-start gap-3 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-3 select-none">
      <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
        <Heart className="w-6 h-6 text-primary" fill="currentColor" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-bold text-foreground">حمایت از ایتاشات</p>
          <button
            onClick={onDismiss}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            aria-label="بستن"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        <button onClick={onNavigate} className="text-right text-xs text-muted-foreground leading-snug hover:text-foreground">
          با حمایت شما ایتاشات بهتر و پایدارتر می‌ماند.
        </button>
        {expanded && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            کمک‌های شما برای نگهداری سرویس، بهبود ابزارهای ویرایش و ادامه توسعه ایتاشات استفاده می‌شود.
          </p>
        )}
        <button
          onClick={() => {
            setExpanded(v => !v);
            if (expanded) onCollapse(); else onExpand();
          }}
          className="text-[11px] text-primary font-medium"
        >
          {expanded ? "کمتر" : "بیشتر"}
        </button>
      </div>
    </div>
  );
}
