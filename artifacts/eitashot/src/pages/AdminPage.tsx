/**
 * Administrator panel — accessible only to the "dev_user" account.
 * Sections: Channel Verification · Advertisement Review · Pricing
 */

import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { EitashotLogo } from "@/components/EitashotLogo";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, X, Loader2, Shield, Image as ImageIcon, MessageSquare,
  DollarSign, ChevronDown, AlertCircle, Megaphone, Settings2, Plus, Trash2, Upload,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toPersianNumber } from "@/lib/jalali";
import { ADMIN_USERNAME } from "@/lib/adminConfig";
import { toast } from "@/hooks/use-toast";

// ── Auth-aware fetch helper ───────────────────────────────────────────────────
function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChannelRow {
  id: number;
  username: string;
  channelUsername: string;
  channelLink: string;
  verificationCode: string;
  status: string;
  reviewNote?: string | null;
  submittedAt: string;
}

interface AdRow {
  id: number;
  channelName: string;
  channelLink: string;
  adText: string;
  adImage: string;
  status: string;
  createdAt: string;
}

interface FeedbackRow {
  id: number;
  message: string;
  username: string;
  createdAt: string;
}

interface Pricing {
  donation_presets: number[];
  donation_monthly_target_tomans: number;
  slot_0_price_tomans: number;
  slot_1_price_tomans: number;
  slot_2_price_tomans: number;
  slot_3_price_tomans: number;
  ad_submissions_disabled: boolean;
  default_custom_ads: Array<{ channelName: string; channelLink: string; adText: string; adImage: string }>;
  active_default_ad: string;
}

type Panel = "channels" | "ads" | "feedback" | "defaults" | "pricing";

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { auth } = useAuth();
  const getToken = useToken();
  const [activePanel, setActivePanel] = useState<Panel>("channels");

  // Guard: only dev_user
  if (auth.status !== "authenticated" || (auth as any).user?.username !== ADMIN_USERNAME) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-background" dir="rtl">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <p className="font-bold text-foreground">دسترسی مجاز نیست</p>
          <button onClick={() => setLocation("/")} className="text-sm text-primary underline">بازگشت</button>
        </div>
      </div>
    );
  }

  const PANELS: { id: Panel; label: string; icon: React.ReactNode }[] = [
    { id: "channels", label: "تأیید کانال", icon: <Shield className="w-4 h-4" /> },
    { id: "ads",      label: "بررسی آگهی", icon: <ImageIcon className="w-4 h-4" /> },
    { id: "feedback", label: "بازخوردها", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "defaults", label: "پیش‌فرض‌ها", icon: <Megaphone className="w-4 h-4" /> },
    { id: "pricing",  label: "قیمت‌گذاری", icon: <DollarSign className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-dvh w-full max-w-[560px] mx-auto flex flex-col bg-background" dir="rtl">
      <header className="h-13 bg-card border-b border-border flex items-center justify-between px-3 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <EitashotLogo size={24} />
          <span className="font-bold text-sm text-foreground">پنل ادمین</span>
        </div>
        <button onClick={() => setLocation("/settings")}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
          <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      {/* Tab bar */}
      <div className="flex border-b border-border bg-card sticky top-13 z-10">
        {PANELS.map((p) => (
          <button key={p.id} onClick={() => setActivePanel(p.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 ${
              activePanel === p.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {p.icon}
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activePanel === "channels" && <ChannelVerificationPanel getToken={getToken} />}
        {activePanel === "ads"      && <AdReviewPanel getToken={getToken} />}
        {activePanel === "feedback" && <FeedbackPanel getToken={getToken} />}
        {activePanel === "defaults" && <DefaultAdsPanel getToken={getToken} />}
        {activePanel === "pricing"  && <PricingPanel getToken={getToken} />}
      </div>
    </div>
  );
}

function FeedbackPanel({ getToken }: { getToken: () => string | null }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ feedback: FeedbackRow[] }>({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const res = await fetch("/api/admin/feedback", { headers: authHeaders(getToken()) });
      return res.json();
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "DELETE",
        headers: authHeaders(getToken()),
      });
      if (!res.ok) throw new Error("delete_failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-feedback"] });
      toast({ title: "بازخورد حذف شد" });
    },
    onError: () => toast({ title: "حذف بازخورد انجام نشد", variant: "destructive" }),
  });

  const feedback = data?.feedback ?? [];
  return (
    <div className="p-4 space-y-3">
      {isLoading && <LoadingRow />}
      {!isLoading && feedback.length === 0 && <EmptyRow text="بازخوردی ثبت نشده است" />}
      {feedback.map((item) => (
        <div key={item.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-primary" dir="ltr">@{item.username}</span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(item.createdAt).toLocaleString("fa-IR")}
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{item.message}</p>
          <button
            onClick={() => { if (confirm("این بازخورد حذف شود؟")) remove.mutate(item.id); }}
            disabled={remove.isPending}
            className="w-full h-9 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold rounded-xl text-xs flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> حذف بازخورد
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Channel Verification Panel ────────────────────────────────────────────────
function ChannelVerificationPanel({ getToken }: { getToken: () => string | null }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ channels: ChannelRow[] }>({
    queryKey: ["admin-channels"],
    queryFn: async () => {
      const res = await fetch("/api/admin/channels", { headers: authHeaders(getToken()) });
      return res.json();
    },
  });

  const action = useMutation({
    mutationFn: async ({ id, action, note }: { id: number; action: "approve" | "reject"; note?: string }) => {
      const res = await fetch(`/api/admin/channels/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(getToken()) },
        body: JSON.stringify({ note: note ?? "" }),
      });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-channels"] }); toast({ title: "عملیات انجام شد" }); },
    onError: () => toast({ title: "خطایی رخ داد", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/channels/${id}`, { method: "DELETE", headers: authHeaders(getToken()) });
      if (!res.ok) throw new Error("remove_failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-channels"] }); toast({ title: "کانال حذف شد" }); },
    onError: () => toast({ title: "حذف کانال انجام نشد", variant: "destructive" }),
  });

  const channels = data?.channels ?? [];

  return (
    <div className="p-4 space-y-3">
      {isLoading && <LoadingRow />}
      {!isLoading && channels.length === 0 && <EmptyRow text="درخواست در انتظار بررسی وجود ندارد" />}
      {channels.map((ch) => (
        <ChannelCard key={ch.id} channel={ch}
          onApprove={() => action.mutate({ id: ch.id, action: "approve" })}
          onReject={(note) => action.mutate({ id: ch.id, action: "reject", note })}
          onRemove={() => { if (confirm("این کانال تأییدشده حذف شود؟")) remove.mutate(ch.id); }}
          busy={action.isPending || remove.isPending} />
      ))}
    </div>
  );
}

function ChannelCard({ channel, onApprove, onReject, onRemove, busy }: {
  channel: ChannelRow;
  onApprove: () => void;
  onReject: (note: string) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);

  const statusColor = { pending: "amber", approved: "green", rejected: "red" }[channel.status] ?? "gray";

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="font-bold text-sm text-foreground" dir="ltr">@{channel.username}</p>
          <a href={channel.channelLink} target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary" dir="ltr">{channel.channelLink}</a>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border bg-${statusColor}-500/10 text-${statusColor}-700 dark:text-${statusColor}-400 border-${statusColor}-500/20 shrink-0`}>
          {channel.status}
        </span>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>کد تأیید: <span className="font-mono font-bold text-foreground" dir="ltr">{channel.verificationCode}</span></p>
        <p>تاریخ: {new Date(channel.submittedAt).toLocaleDateString("fa-IR")}</p>
      </div>

      {channel.status === "pending" && (
        <div className="space-y-2">
          {showReject && (
            <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
              placeholder="دلیل رد (اختیاری)" dir="rtl"
              className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary" />
          )}
          <div className="flex gap-2">
            <button onClick={onApprove} disabled={busy}
              className="flex-1 h-9 bg-green-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> تأیید
            </button>
            <button onClick={() => showReject ? onReject(rejectNote) : setShowReject(true)} disabled={busy}
              className="flex-1 h-9 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold rounded-xl text-xs flex items-center justify-center gap-1 disabled:opacity-50">
              <X className="w-3.5 h-3.5" /> {showReject ? "ارسال رد" : "رد کردن"}
            </button>
          </div>
        </div>
      )}
      {channel.status === "approved" && (
        <button onClick={onRemove} disabled={busy}
          className="w-full h-9 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold rounded-xl text-xs flex items-center justify-center gap-1 disabled:opacity-50">
          <Trash2 className="w-3.5 h-3.5" /> حذف کانال تأییدشده
        </button>
      )}
    </div>
  );
}

// ── Ad Review Panel ───────────────────────────────────────────────────────────
function AdReviewPanel({ getToken }: { getToken: () => string | null }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ ads: AdRow[] }>({
    queryKey: ["admin-ads"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ads", { headers: authHeaders(getToken()) });
      return res.json();
    },
  });

  const action = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "approve" | "reject" }) => {
      const res = await fetch(`/api/admin/ads/${id}/${action}`, {
        method: "POST",
        headers: authHeaders(getToken()),
      });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-ads"] }); toast({ title: "آگهی به‌روزرسانی شد" }); },
    onError: () => toast({ title: "خطایی رخ داد", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/ads/${id}`, { method: "DELETE", headers: authHeaders(getToken()) });
      if (!res.ok) throw new Error("remove_failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-ads"] }); toast({ title: "آگهی حذف شد" }); },
    onError: () => toast({ title: "حذف آگهی انجام نشد", variant: "destructive" }),
  });

  const ads = data?.ads ?? [];

  return (
    <div className="p-4 space-y-3">
      {isLoading && <LoadingRow />}
      {!isLoading && ads.length === 0 && <EmptyRow text="آگهی در انتظار بررسی وجود ندارد" />}
      {ads.map((ad) => (
        <div key={ad.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          {/* Ad preview */}
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
              <img src={ad.adImage} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="font-bold text-sm text-foreground truncate">{ad.channelName}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{ad.adText}</p>
              <a href={ad.channelLink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary" dir="ltr">
                {ad.channelLink}
              </a>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{new Date(ad.createdAt).toLocaleDateString("fa-IR")}</p>
          {/* Status badge */}
          {ad.status === "content_approved" && (
            <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1 text-center">
              تأییدشده
            </p>
          )}
          <div className="flex gap-2">
            {ad.status === "draft" && (
              <>
                <button onClick={() => action.mutate({ id: ad.id, action: "approve" })} disabled={action.isPending}
                  className="flex-1 h-9 bg-green-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 disabled:opacity-50">
                  <Check className="w-3.5 h-3.5" /> تأیید
                </button>
                <button onClick={() => action.mutate({ id: ad.id, action: "reject" })} disabled={action.isPending}
                  className="flex-1 h-9 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold rounded-xl text-xs flex items-center justify-center gap-1 disabled:opacity-50">
                  <X className="w-3.5 h-3.5" /> رد
                </button>
              </>
            )}
            {ad.status === "content_approved" && (
              <button
                onClick={() => { if (confirm("این آگهی تأییدشده حذف شود؟")) remove.mutate(ad.id); }}
                disabled={remove.isPending}
                className="flex-1 h-9 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold rounded-xl text-xs flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> حذف آگهی تأییدشده
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Pricing Panel ─────────────────────────────────────────────────────────────
const SLOT_NAMES = ["۰۰:۰۰ – ۰۶:۰۰", "۰۶:۰۰ – ۱۲:۰۰", "۱۲:۰۰ – ۱۸:۰۰", "۱۸:۰۰ – ۲۴:۰۰"];

function PricingPanel({ getToken }: { getToken: () => string | null }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ pricing: Pricing }>({
    queryKey: ["admin-pricing"],
    queryFn: async () => {
      const res = await fetch("/api/admin/pricing", { headers: authHeaders(getToken()) });
      return res.json();
    },
  });

  const pricing = data?.pricing;

  // Local editable state
  const [slotPrices, setSlotPrices] = useState<string[]>(["", "", "", ""]);
  const [presets, setPresets] = useState<string>("");
  const [donationTarget, setDonationTarget] = useState<string>("");
  const [submissionsDisabled, setSubmissionsDisabled] = useState(false);

  // Initialize when data loads (runs once when slotPrices is still empty)
  if (pricing && slotPrices[0] === "") {
    setSlotPrices([
      String(pricing.slot_0_price_tomans),
      String(pricing.slot_1_price_tomans),
      String(pricing.slot_2_price_tomans),
      String(pricing.slot_3_price_tomans),
    ]);
    setPresets(pricing.donation_presets.join(", "));
    setDonationTarget(String(pricing.donation_monthly_target_tomans ?? 298000));
    setSubmissionsDisabled(pricing.ad_submissions_disabled ?? false);
  }

  const save = useMutation({
    mutationFn: async () => {
      const parsedPresets = presets.split(/[,،\s]+/).map(Number).filter((n) => n > 0);
      const body: Record<string, unknown> = {
        donation_presets: parsedPresets,
        donation_monthly_target_tomans: Number(donationTarget) || 298000,
        slot_0_price_tomans: Number(slotPrices[0]),
        slot_1_price_tomans: Number(slotPrices[1]),
        slot_2_price_tomans: Number(slotPrices[2]),
        slot_3_price_tomans: Number(slotPrices[3]),
        ad_submissions_disabled: submissionsDisabled,
      };
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(getToken()) },
        body: JSON.stringify(body),
      });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pricing"] }); toast({ title: "قیمت‌ها ذخیره شد" }); },
    onError: () => toast({ title: "خطا در ذخیره", variant: "destructive" }),
  });

  return (
    <div className="p-4 space-y-5">
      {isLoading && <LoadingRow />}
      {!isLoading && pricing && (
        <>
          {/* Slot prices */}
          <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-sm text-foreground">قیمت بازه‌های تبلیغاتی (تومان)</h3>
            {SLOT_NAMES.map((name, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr] items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap" dir="ltr">{name}</span>
                <input
                  type="number"
                  value={slotPrices[i]}
                  onChange={(e) => setSlotPrices((p) => { const n = [...p]; n[i] = e.target.value; return n; })}
                  className="w-full min-w-0 h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary text-left"
                  dir="ltr"
                  min={1000}
                />
              </div>
            ))}
          </section>

          {/* Donation presets */}
          <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-sm text-foreground">مبالغ پیش‌فرض کمک مالی (تومان)</h3>
            <p className="text-xs text-muted-foreground">مقادیر را با کاما یا فاصله جدا کنید</p>
            <input
              type="text"
              value={presets}
              onChange={(e) => setPresets(e.target.value)}
              placeholder="مثال: 10000, 30000, 50000, 100000"
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
              dir="ltr"
            />
            <div className="flex gap-2 flex-wrap">
              {presets.split(/[,،\s]+/).map(Number).filter((n) => n > 0).map((n, i) => (
                <span key={i} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                  {toPersianNumber(n)} تومان
                </span>
              ))}
            </div>
          </section>

          {/* Monthly donation target */}
          <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-sm text-foreground">هدف ماهانه کمک مالی (تومان)</h3>
            <p className="text-xs text-muted-foreground">این مقدار در نوار پیشرفت صفحه اصلی نمایش داده می‌شود</p>
            <input
              type="number"
              value={donationTarget}
              onChange={(e) => setDonationTarget(e.target.value)}
              placeholder="298000"
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary text-left"
              dir="ltr"
              min={1000}
            />
            {Number(donationTarget) > 0 && (
              <p className="text-xs text-muted-foreground">
                معادل: <span className="font-medium text-foreground">{toPersianNumber(Number(donationTarget))} تومان</span>
              </p>
            )}
          </section>

          {/* Maintenance mode */}
          <section className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-foreground">تعلیق ثبت آگهی کاربران</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  آگهی‌های پیش‌فرض همچنان نمایش داده می‌شوند
                </p>
              </div>
              <button
                onClick={() => setSubmissionsDisabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                  submissionsDisabled ? "bg-destructive" : "bg-muted-foreground/30"
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  submissionsDisabled ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>
            {submissionsDisabled && (
              <p className="mt-2.5 text-xs font-medium text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
                ⚠ ثبت آگهی جدید توسط کاربران در حال حاضر غیرفعال است
              </p>
            )}
          </section>

          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="w-full h-12 bg-primary text-white font-bold rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "ذخیره تغییرات"}
          </button>
        </>
      )}
    </div>
  );
}

// ── Default Ads Panel ─────────────────────────────────────────────────────────
function DefaultAdsPanel({ getToken }: { getToken: () => string | null }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ pricing: Pricing }>({
    queryKey: ["admin-pricing"],
    queryFn: async () => {
      const res = await fetch("/api/admin/pricing", { headers: authHeaders(getToken()) });
      return res.json();
    },
  });

  const customAds = data?.pricing?.default_custom_ads ?? [];
  const activeDefault = data?.pricing?.active_default_ad ?? "built_in_promo";

  // Add-form state
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formText, setFormText] = useState("");
  const [formImage, setFormImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: async (payload: { default_custom_ads?: Pricing["default_custom_ads"]; active_default_ad?: string }) => {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(getToken()) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pricing"] }); toast({ title: "ذخیره شد" }); },
    onError: () => toast({ title: "خطا در ذخیره", variant: "destructive" }),
  });

  const handleAdd = () => {
    if (!formName.trim() || !formLink.trim() || !formText.trim() || !formImage) {
      toast({ title: "همه فیلدها الزامی هستند", variant: "destructive" });
      return;
    }
    save.mutate({ default_custom_ads: [...customAds, {
      channelName: formName.trim(),
      channelLink: formLink.trim(),
      adText: formText.trim(),
      adImage: formImage,
    }] });
    setShowForm(false);
    setFormName(""); setFormLink(""); setFormText(""); setFormImage(null);
  };

  const handleDelete = (idx: number) => {
    const nextActive = activeDefault === `custom:${idx}` ? "built_in_promo"
      : activeDefault.startsWith("custom:") && Number(activeDefault.slice(7)) > idx
        ? `custom:${Number(activeDefault.slice(7)) - 1}` : activeDefault;
    save.mutate({ default_custom_ads: customAds.filter((_, i) => i !== idx), active_default_ad: nextActive });
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFormImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="p-4 space-y-4">
      {/* Built-in defaults (read-only info) */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-2">
        <h3 className="font-bold text-sm text-foreground">آگهی‌های پیش‌فرض ثابت</h3>
        <p className="text-xs text-muted-foreground">این موارد همیشه در دسترس هستند و قابل حذف نیستند</p>
        <div className="space-y-2 pt-1">
          <button onClick={() => save.mutate({ active_default_ad: "built_in_promo" })}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-right ${activeDefault === "built_in_promo" ? "bg-primary/10 border border-primary text-primary" : "bg-primary/5 border border-primary/15 text-muted-foreground"}`}>
            <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
            تبلیغ اپلیکیشن ایتاشات
          </button>
          <button onClick={() => save.mutate({ active_default_ad: "built_in_donation" })}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-right ${activeDefault === "built_in_donation" ? "bg-green-500/10 border border-green-500 text-green-700" : "bg-green-500/5 border border-green-500/15 text-muted-foreground"}`}>
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            آگهی حمایت مالی از پروژه
          </button>
        </div>
      </section>

      {/* Custom defaults list */}
      <section className="space-y-2">
        <h3 className="font-bold text-sm text-foreground">آگهی‌های پیش‌فرض سفارشی</h3>
        {isLoading && <LoadingRow />}
        {!isLoading && customAds.length === 0 && (
          <EmptyRow text="هیچ آگهی سفارشی پیش‌فرضی تعریف نشده است" />
        )}
        {customAds.map((ad, idx) => (
          <div key={idx} className={`bg-card border rounded-2xl p-3 flex items-start gap-3 ${activeDefault === `custom:${idx}` ? "border-primary" : "border-border"}`}>
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0 border border-border">
              <img src={ad.adImage} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="font-bold text-sm text-foreground truncate">{ad.channelName}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{ad.adText}</p>
              <a href={ad.channelLink} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-primary truncate block" dir="ltr">{ad.channelLink}</a>
            </div>
            <button onClick={() => handleDelete(idx)} disabled={save.isPending}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-40">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => save.mutate({ active_default_ad: `custom:${idx}` })} disabled={save.isPending}
              className={`self-center px-2 py-1 rounded-lg text-[10px] font-bold ${activeDefault === `custom:${idx}` ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
              {activeDefault === `custom:${idx}` ? "فعال" : "انتخاب"}
            </button>
          </div>
        ))}
      </section>

      {/* Add form */}
      {showForm ? (
        <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="font-bold text-sm text-foreground">آگهی پیش‌فرض جدید</h3>
          <input value={formName} onChange={(e) => setFormName(e.target.value)}
            placeholder="نام کانال" maxLength={100}
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary" />
          <input value={formLink} onChange={(e) => setFormLink(e.target.value)}
            placeholder="لینک کانال (https://eitaa.com/...)" dir="ltr" maxLength={200}
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary" />
          <textarea value={formText} onChange={(e) => setFormText(e.target.value)}
            placeholder="متن آگهی" maxLength={300} rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary resize-none" />

          <input type="file" accept="image/*" ref={imageInputRef} className="hidden" onChange={handleImagePick} />
          {formImage ? (
            <div className="relative w-full h-32 rounded-xl overflow-hidden bg-muted border border-border">
              <img src={formImage} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setFormImage(null)}
                className="absolute top-2 left-2 w-7 h-7 bg-black/60 rounded-lg flex items-center justify-center text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => imageInputRef.current?.click()}
              className="w-full h-10 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground flex items-center justify-center gap-2 hover:border-primary/40 transition-colors">
              <Upload className="w-4 h-4" /> آپلود تصویر
            </button>
          )}

          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={save.isPending}
              className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "ذخیره"}
            </button>
            <button onClick={() => { setShowForm(false); setFormName(""); setFormLink(""); setFormText(""); setFormImage(null); }}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </section>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full h-12 border-2 border-dashed border-border rounded-2xl text-sm font-medium text-muted-foreground flex items-center justify-center gap-2 hover:border-primary/40 hover:text-foreground transition-all">
          <Plus className="w-4 h-4" /> افزودن آگهی پیش‌فرض سفارشی
        </button>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function LoadingRow() {
  return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
}
function EmptyRow({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground text-center py-8 bg-muted/30 rounded-xl border border-dashed border-border">{text}</p>;
}
