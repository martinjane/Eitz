import React, { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useEditor } from "@/contexts/EditorContext";
import { useAuth } from "@/contexts/AuthContext";
import { EitashotLogo } from "@/components/EitashotLogo";
import {
  ArrowRight, Sparkles, Image as ImageIcon, Trash2, Loader2,
  Upload, Plus, Shield, Check, X, Clock, ChevronDown, ShieldCheck,
  Pencil, CheckCircle2, XCircle, Megaphone, Ban, DollarSign, Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { listSavedStyles, deleteSavedStyle, type SavedStyleRecord } from "@/lib/savedStylesApi";
import { listLogos, uploadLogo, deleteLogo, type LogoRecord } from "@/lib/logosApi";
import { toast } from "@/hooks/use-toast";
import { ADMIN_USERNAME } from "@/lib/adminConfig";
import { useAutoReduce } from "@/hooks/useAutoReduce";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SavedAdRecord {
  id: number;
  channelLink: string;
  channelName: string;
  adText: string;
  adImage: string;
  status: "draft" | "content_approved" | "content_rejected";
  reviewNote?: string | null;
  createdAt: string;
}

interface PaymentRecord {
  id: number;
  orderId: string;
  type: string;
  amountRials: number;
  status: "pending" | "verified" | "failed";
  paymentUrl: string | null;
  paymentUrlExpiresAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

interface ChannelRecord {
  id: number;
  channelUsername: string;
  channelLink: string;
  verificationCode: string;
  status: "pending" | "approved" | "rejected";
  reviewNote?: string | null;
  submittedAt: string;
}

// ── Image compression helper ──────────────────────────────────────────────────
async function compressImage(dataUrl: string, maxBytes: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0);
      let quality = 0.92;
      const tryCompress = () => {
        const result = canvas.toDataURL("image/jpeg", quality);
        const bytes = Math.ceil((result.length - result.indexOf(",") - 1) * 0.75);
        if (bytes <= maxBytes || quality < 0.1) { resolve(result); }
        else { quality = Math.max(0.05, quality - 0.1); tryCompress(); }
      };
      tryCompress();
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ── Channel helpers ───────────────────────────────────────────────────────────
const OWNERSHIP_TERMS =
  "من مالک یا مدیر این کانال ایتا هستم و مسئولیت کامل ادعای مالکیت را می‌پذیرم. در صورت ارائه اطلاعات نادرست، درخواست رد خواهد شد.";

// Bold text renderer: **text** → <strong>text</strong>
function renderBoldText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

async function fetchMyChannels(token: string | null): Promise<ChannelRecord[]> {
  const res = await fetch("/api/channels/mine", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.channels ?? [];
}

async function submitChannel(token: string | null, channelUsername: string) {
  const res = await fetch("/api/channels/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ channelUsername }),
  });
  return res.json();
}

// ── Main page ─────────────────────────────────────────────────────────────────
const USERNAME_REGEX = /^[a-z0-9_]{3,16}$/;
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function usernameHint(u: string): string | null {
  if (!u) return null;
  if (u.length < 3) return "حداقل ۳ کاراکتر";
  if (u.length > 16) return "حداکثر ۱۶ کاراکتر";
  if (!/^[a-z0-9_]+$/.test(u)) return "فقط حروف انگلیسی کوچک، اعداد و زیرخط (_)";
  return null;
}

type AvailState = "idle" | "checking" | "available" | "taken" | "same" | "invalid";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { enterStyleMode } = useEditor();
  const { getToken, auth, updateUsername } = useAuth();
  const logoUploadRef = React.useRef<HTMLInputElement>(null);

  // ── Username edit state ───────────────────────────────────────────────────
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameAvail, setUsernameAvail] = useState<AvailState>("idle");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const usernameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUsernameAvail = useCallback((val: string, currentUsername: string) => {
    if (usernameDebounce.current) clearTimeout(usernameDebounce.current);
    if (val === currentUsername) { setUsernameAvail("same"); return; }
    if (!USERNAME_REGEX.test(val)) { setUsernameAvail(usernameHint(val) ? "invalid" : "idle"); return; }
    setUsernameAvail("checking");
    usernameDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/check-username/${encodeURIComponent(val)}`);
        const data = await res.json() as { available: boolean };
        setUsernameAvail(data.available ? "available" : "taken");
      } catch { setUsernameAvail("idle"); }
    }, 450);
  }, []);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim().toLowerCase();
    setNewUsername(val);
    setUsernameError(null);
    const current = auth.status === "authenticated" ? auth.user.username : "";
    checkUsernameAvail(val, current);
  };

  const handleUsernameSave = async () => {
    if (usernameAvail !== "available") return;
    setUsernameSaving(true);
    setUsernameError(null);
    const result = await updateUsername(newUsername);
    setUsernameSaving(false);
    if (!result.ok) {
      setUsernameError(result.error ?? "خطای ناشناخته");
      const current = auth.status === "authenticated" ? auth.user.username : "";
      checkUsernameAvail(newUsername, current);
    } else {
      setEditingUsername(false);
      setNewUsername("");
      setUsernameAvail("idle");
    }
  };

  const [styles, setStyles] = useState<SavedStyleRecord[]>([]);
  const [stylesLoading, setStylesLoading] = useState(true);
  const [deletingStyle, setDeletingStyle] = useState<number | null>(null);

  const [logos, setLogos] = useState<LogoRecord[]>([]);
  const [logosLoading, setLogosLoading] = useState(true);
  const [deletingLogo, setDeletingLogo] = useState<number | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Channel verification state
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [channelInput, setChannelInput] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submittingChannel, setSubmittingChannel] = useState(false);
  const [cancellingChannel, setCancellingChannel] = useState<number | null>(null);

  // Payment history state
  const [myPayments, setMyPayments] = useState<PaymentRecord[]>([]);
  const [myPaymentsLoading, setMyPaymentsLoading] = useState(false);

  // My Advertisements state
  const [myAds, setMyAds] = useState<SavedAdRecord[]>([]);
  const [myAdsLoading, setMyAdsLoading] = useState(false);
  const [showAdForm, setShowAdForm] = useState(false);
  const [adFormChannelId, setAdFormChannelId] = useState<number | null>(null);
  const [adFormText, setAdFormText] = useState("");
  const [adFormImage, setAdFormImage] = useState<string | null>(null);
  const [adImageProcessing, setAdImageProcessing] = useState(false);
  const [submittingAd, setSubmittingAd] = useState(false);
  const [cancellingAd, setCancellingAd] = useState<number | null>(null);
  const adImageInputRef = React.useRef<HTMLInputElement>(null);

  const isLoggedIn = auth.status === "authenticated";
  const isAdmin = isLoggedIn && (auth as any).user?.username === ADMIN_USERNAME;

  useEffect(() => {
    const token = getToken();
    Promise.all([listSavedStyles(token), listLogos(token)]).then(([sr, lr]) => {
      if (sr.ok && sr.styles) setStyles(sr.styles);
      setStylesLoading(false);
      if (lr.ok && lr.logos) setLogos(lr.logos);
      setLogosLoading(false);
    });
    if (isLoggedIn) {
      const t = getToken();
      setChannelsLoading(true);
      fetchMyChannels(t).then((ch) => { setChannels(ch); setChannelsLoading(false); });
      setMyAdsLoading(true);
      fetch("/api/ads/mine", { headers: t ? { Authorization: `Bearer ${t}` } : {} })
        .then(r => r.ok ? r.json() : { ads: [] })
        .then(d => { setMyAds(d.ads ?? []); setMyAdsLoading(false); });
      setMyPaymentsLoading(true);
      fetch("/api/payments/mine", { headers: t ? { Authorization: `Bearer ${t}` } : {} })
        .then(r => r.ok ? r.json() : { payments: [] })
        .then(d => { setMyPayments(d.payments ?? []); setMyPaymentsLoading(false); });
    }
  }, [isLoggedIn]);

  const handleDeleteStyle = useCallback(async (id: number) => {
    if (!confirm("این استایل حذف شود؟")) return;
    setDeletingStyle(id);
    const result = await deleteSavedStyle(getToken(), id);
    setDeletingStyle(null);
    if (!result.ok) { toast({ title: "خطا در حذف", description: result.error, variant: "destructive" }); return; }
    setStyles(prev => prev.filter(s => s.id !== id));
    toast({ title: "استایل حذف شد" });
  }, [getToken]);

  const handleDeleteLogo = useCallback(async (id: number) => {
    if (!confirm("این لوگو حذف شود؟")) return;
    setDeletingLogo(id);
    const result = await deleteLogo(getToken(), id);
    setDeletingLogo(null);
    if (!result.ok) { toast({ title: "خطا در حذف لوگو", description: result.error, variant: "destructive" }); return; }
    setLogos(prev => prev.filter(l => l.id !== id));
    toast({ title: "لوگو حذف شد" });
  }, [getToken]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingLogo(true);
    const result = await uploadLogo(getToken(), file);
    setUploadingLogo(false);
    if (!result.ok || !result.logo) { toast({ title: "خطا در آپلود", description: result.error, variant: "destructive" }); return; }
    setLogos(prev => [...prev, result.logo!]);
    toast({ title: "لوگو ذخیره شد" });
  };

  const handleChannelSubmit = async () => {
    const username = channelInput.trim();
    if (!username) { toast({ title: "نام کاربری را وارد کنید", variant: "destructive" }); return; }
    if (!termsAccepted) { toast({ title: "ابتدا شرایط را بپذیرید", variant: "destructive" }); return; }
    setSubmittingChannel(true);
    const result = await submitChannel(getToken(), username);
    setSubmittingChannel(false);
    if (result.error) {
      toast({ title: result.message ?? "خطایی رخ داد", variant: "destructive" });
      return;
    }
    setChannels(prev => [...prev, result.channel]);
    setShowChannelForm(false);
    setChannelInput("");
    setTermsAccepted(false);
    toast({ title: "درخواست تأیید مالکیت ثبت شد" });
  };

  const handleChannelCancel = async (id: number) => {
    if (!confirm("این درخواست لغو شود؟")) return;
    setCancellingChannel(id);
    const t = getToken();
    const res = await fetch(`/api/channels/${id}`, {
      method: "DELETE",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    setCancellingChannel(null);
    if (res.ok) {
      setChannels(prev => prev.filter(c => c.id !== id));
      toast({ title: "درخواست تأیید لغو شد" });
    } else {
      toast({ title: "خطا در لغو درخواست", variant: "destructive" });
    }
  };

  const handleAdImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast({ title: "فرمت تصویر نامعتبر است", description: "فقط JPEG، PNG، WEBP یا GIF مجاز است", variant: "destructive" });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "حجم تصویر زیاد است", description: "حجم فایل حداکثر ۱۵ مگابایت باشد", variant: "destructive" });
      return;
    }
    setAdImageProcessing(true);
    setAdFormImage(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const raw = ev.target?.result;
        if (typeof raw !== "string") throw new Error("image_read_failed");
        const compressed = await compressImage(raw, 500 * 1024);
        setAdFormImage(compressed);
      } catch {
        toast({ title: "پردازش تصویر انجام نشد", description: "لطفاً تصویر دیگری انتخاب کنید", variant: "destructive" });
      } finally {
        setAdImageProcessing(false);
      }
    };
    reader.onerror = () => {
      setAdImageProcessing(false);
      toast({ title: "خواندن تصویر انجام نشد", variant: "destructive" });
    };
    try {
      reader.readAsDataURL(file);
    } catch {
      setAdImageProcessing(false);
      toast({ title: "خواندن تصویر انجام نشد", variant: "destructive" });
    }
  };

  const handleAdCreate = async () => {
    if (!adFormChannelId) { toast({ title: "یک کانال انتخاب کنید", variant: "destructive" }); return; }
    if (!adFormText.trim()) { toast({ title: "متن آگهی را بنویسید", variant: "destructive" }); return; }
    if (!adFormImage) { toast({ title: "یک تصویر انتخاب کنید", variant: "destructive" }); return; }
    setSubmittingAd(true);
    try {
      const t = getToken();
      const res = await fetch("/api/ads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({
          channelVerificationId: adFormChannelId,
          adText: adFormText.trim(),
          adImage: adFormImage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.message ?? "خطا در ایجاد آگهی", variant: "destructive" });
        return;
      }
      if (!data.ad) throw new Error("invalid_response");
      setMyAds(prev => [...prev, data.ad]);
      setShowAdForm(false);
      setAdFormChannelId(null); setAdFormText(""); setAdFormImage(null);
      toast({ title: "آگهی ثبت شد و در انتظار بررسی است" });
    } catch {
      toast({ title: "ارتباط با سرور برقرار نشد", description: "لطفاً دوباره تلاش کنید", variant: "destructive" });
    } finally {
      setSubmittingAd(false);
    }
  };

  const handleAdCancel = async (id: number) => {
    if (!confirm("این آگهی لغو و حذف شود؟")) return;
    setCancellingAd(id);
    const t = getToken();
    const res = await fetch(`/api/ads/saved/${id}`, {
      method: "DELETE",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    setCancellingAd(null);
    if (res.ok) {
      setMyAds(prev => prev.filter(a => a.id !== id));
      toast({ title: "آگهی حذف شد" });
    } else {
      toast({ title: "خطا در حذف آگهی", variant: "destructive" });
    }
  };

  const stylesCapped = styles.length >= 5;
  const logosCapped  = logos.length >= 5;

  return (
    <div className="min-h-dvh w-full max-w-[520px] mx-auto flex flex-col bg-background" dir="rtl">
      <header className="h-13 bg-card border-b border-border flex items-center justify-between px-3 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <EitashotLogo size={24} />
          <span className="font-bold text-sm text-foreground">تنظیمات</span>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setLocation("/admin")}
              className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg hover:bg-amber-500/15 transition-colors">
              <ShieldCheck className="w-3.5 h-3.5" />
              پنل ادمین
            </button>
          )}
          <button onClick={() => setLocation("/")}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-10">

        {/* Account card */}
        {auth.status === "authenticated" && (
          <div className="px-4 pt-5 pb-1 space-y-2">
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold text-lg">{auth.user.username.slice(0, 1).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-foreground" dir="ltr">@{auth.user.username}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                </div>
                {auth.user.firstName && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {auth.user.firstName}{auth.user.lastName ? " " + auth.user.lastName : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-2 py-1 rounded-lg font-medium">ایتا</span>
                <button
                  onClick={() => { setEditingUsername(p => !p); setNewUsername(""); setUsernameAvail("idle"); setUsernameError(null); }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="ویرایش نام کاربری"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Username edit panel */}
            <AnimatePresence>
              {editingUsername && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3" dir="rtl">
                    <p className="text-sm font-semibold text-foreground">تغییر نام کاربری</p>
                    <div className="relative">
                      <input
                        type="text"
                        value={newUsername}
                        onChange={handleUsernameChange}
                        placeholder={auth.user.username}
                        dir="ltr"
                        maxLength={16}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        className="w-full h-11 rounded-xl border border-border bg-background px-4 pl-10 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">
                        {usernameAvail === "checking" && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                        {usernameAvail === "available" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {(usernameAvail === "taken" || usernameAvail === "invalid") && <XCircle className="w-4 h-4 text-destructive" />}
                      </span>
                    </div>
                    <AnimatePresence mode="wait">
                      {(usernameError || usernameAvail === "taken" || usernameAvail === "invalid") && (
                        <motion.p key="err" className="text-xs text-destructive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          {usernameError ?? (usernameAvail === "taken" ? "این نام کاربری قبلاً گرفته شده" : usernameHint(newUsername))}
                        </motion.p>
                      )}
                      {usernameAvail === "available" && !usernameError && (
                        <motion.p key="ok" className="text-xs text-green-600 dark:text-green-400" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          این نام کاربری موجود است ✓
                        </motion.p>
                      )}
                    </AnimatePresence>
                    <p className="text-[11px] text-muted-foreground">
                      ۳ تا ۱۶ کاراکتر — حروف انگلیسی کوچک، اعداد، زیرخط
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUsernameSave}
                        disabled={usernameAvail !== "available" || usernameSaving}
                        className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity"
                      >
                        {usernameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "ذخیره"}
                      </button>
                      <button
                        onClick={() => { setEditingUsername(false); setNewUsername(""); setUsernameAvail("idle"); setUsernameError(null); }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Owned Channels ── */}
        {isLoggedIn && (
          <>
            <div className="mx-4 mt-5">
              <SectionHeader icon={<Shield className="w-4 h-4" />} title="کانال‌های تأیید شده" />
            </div>
            <div className="px-4 mt-3 space-y-2">
              {channelsLoading ? (
                <LoadingRow />
              ) : channels.length === 0 && !showChannelForm ? (
                <EmptyRow text="هنوز کانالی تأیید نشده" />
              ) : (
                <AnimatePresence>
                  {channels.map((ch) => (
                    <motion.div key={ch.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <ChannelRow channel={ch} onCancel={handleChannelCancel} cancelling={cancellingChannel === ch.id} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {/* Add channel form */}
              <AnimatePresence>
                {showChannelForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="bg-card border border-border rounded-2xl p-4 space-y-3 overflow-hidden">
                    <p className="text-sm font-semibold text-foreground">افزودن کانال جدید</p>

                    {/* Channel username input */}
                    <div className="flex items-center gap-0 border border-border rounded-xl overflow-hidden bg-background">
                      <span className="px-3 text-xs text-muted-foreground bg-muted border-l border-border h-11 flex items-center shrink-0 whitespace-nowrap" dir="ltr">
                        eitaa.com/
                      </span>
                      <input
                        type="text"
                        value={channelInput}
                        onChange={(e) => setChannelInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                        placeholder="channel_username"
                        dir="ltr"
                        className="flex-1 h-11 px-3 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                    </div>

                    {/* Terms */}
                    <button onClick={() => setTermsAccepted(p => !p)}
                      className="w-full flex items-start gap-2.5 text-right text-xs text-muted-foreground leading-5 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                      <div className={`w-4 h-4 shrink-0 mt-0.5 rounded flex items-center justify-center border transition-colors ${termsAccepted ? "bg-primary border-primary" : "border-border bg-background"}`}>
                        {termsAccepted && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span>{OWNERSHIP_TERMS}</span>
                    </button>

                    {/* Verification instructions */}
                    <p className="text-xs text-muted-foreground leading-5 bg-blue-500/5 border border-blue-500/15 rounded-xl p-3">
                      پس از ثبت، یک کد تأیید دریافت می‌کنید. آن را در کانال ایتای خود منتشر کنید تا ادمین مالکیت را تأیید کند.
                    </p>

                    <div className="flex gap-2">
                      <button onClick={handleChannelSubmit} disabled={submittingChannel || !channelInput || !termsAccepted}
                        className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                        {submittingChannel ? <Loader2 className="w-4 h-4 animate-spin" /> : "ارسال درخواست"}
                      </button>
                      <button onClick={() => { setShowChannelForm(false); setChannelInput(""); setTermsAccepted(false); }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!showChannelForm && (
                <button onClick={() => setShowChannelForm(true)}
                  className="w-full h-12 border-2 border-dashed border-primary/30 text-primary rounded-2xl text-sm font-medium flex items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all active:bg-primary/10">
                  <Plus className="w-4 h-4" />
                  افزودن کانال ایتا
                </button>
              )}
            </div>
          </>
        )}

        {/* ── My Advertisements ── */}
        {isLoggedIn && (
          <>
            <div className="mx-4 mt-5">
              <SectionHeader icon={<Megaphone className="w-4 h-4" />} title="آگهی‌های من" />
            </div>
            <div className="px-4 mt-3 space-y-2">
              {myAdsLoading ? (
                <LoadingRow />
              ) : myAds.length === 0 && !showAdForm ? (
                <EmptyRow text="هنوز آگهی‌ای ثبت نشده" />
              ) : (
                <AnimatePresence>
                  {myAds.map((ad) => {
                    const statusStyle = {
                      draft: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
                      content_approved: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
                      content_rejected: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
                    }[ad.status] ?? "bg-muted text-muted-foreground border-border";
                    const statusLabel = {
                      draft: "در انتظار بررسی",
                      content_approved: "تأیید شده",
                      content_rejected: "رد شده",
                    }[ad.status] ?? ad.status;
                    const canCancel = ["draft", "content_approved", "content_rejected"].includes(ad.status);

                    return (
                      <motion.div key={ad.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="bg-card border border-border rounded-2xl overflow-hidden">
                          <div className="flex items-center gap-3 px-3.5 py-3">
                            {ad.adImage && (
                              <div className="shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-muted">
                                <img src={ad.adImage} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{ad.channelName}</p>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-4">
                                {renderBoldText(ad.adText)}
                              </p>
                              <span className={`inline-flex items-center text-[10px] font-medium border px-1.5 py-0.5 rounded-md mt-1 ${statusStyle}`}>
                                {statusLabel}
                              </span>
                            </div>
                            {canCancel && (
                              <button
                                onClick={() => handleAdCancel(ad.id)}
                                disabled={cancellingAd === ad.id}
                                className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors disabled:opacity-30 shrink-0"
                                title="لغو و حذف"
                              >
                                {cancellingAd === ad.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                          {ad.status === "content_rejected" && ad.reviewNote && (
                            <div className="px-3.5 pb-3">
                              <p className="text-[11px] bg-red-500/5 border border-red-500/15 rounded-xl px-3 py-2">
                                <span className="font-semibold text-foreground">دلیل رد: </span>
                                <span className="text-muted-foreground">{ad.reviewNote}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}

              {/* Add advertisement form */}
              <AnimatePresence>
                {showAdForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="bg-card border border-border rounded-2xl p-4 space-y-3 overflow-hidden">
                    <p className="text-sm font-semibold text-foreground">افزودن آگهی جدید</p>

                    {/* Channel selector — only approved channels */}
                    {channels.filter(c => c.status === "approved").length === 0 ? (
                      <div className="w-full px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-400 text-center leading-5">
                        ابتدا باید یک کانال تأیید شده داشته باشید تا بتوانید آگهی ثبت کنید
                      </div>
                    ) : (
                      <select
                        value={adFormChannelId ?? ""}
                        onChange={(e) => setAdFormChannelId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary appearance-none"
                        dir="ltr"
                      >
                        <option value="">انتخاب کانال ...</option>
                        {channels.filter(c => c.status === "approved").map(c => (
                          <option key={c.id} value={c.id}>@{c.channelUsername}</option>
                        ))}
                      </select>
                    )}

                    {/* Ad text */}
                    <div className="space-y-1">
                      <textarea
                        value={adFormText}
                        onChange={(e) => setAdFormText(e.target.value)}
                        maxLength={210}
                        rows={3}
                        placeholder="متن آگهی (توضیح کوتاهی درباره کانال)"
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none text-right"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        برای <strong>متن پررنگ</strong> از <span dir="ltr" className="font-mono">**متن**</span> استفاده کنید
                      </p>
                    </div>

                    {/* Image upload */}
                    <input ref={adImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAdImageSelect} />
                    {adImageProcessing ? (
                      <div className="w-full h-28 rounded-xl border border-border bg-muted/40 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        در حال آماده‌سازی تصویر...
                      </div>
                    ) : adFormImage ? (
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
                        <img src={adFormImage} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setAdFormImage(null)} className="absolute top-1 right-1 w-5 h-5 bg-background/80 rounded-full flex items-center justify-center">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => adImageInputRef.current?.click()}
                        className="w-full h-16 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/40 hover:text-primary/60 transition-colors">
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-xs">تصویر آگهی</span>
                      </button>
                    )}

                    <div className="flex gap-2">
                      <button onClick={handleAdCreate} disabled={submittingAd || adImageProcessing || !adFormChannelId || !adFormText || !adFormImage}
                        className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                        {submittingAd ? <Loader2 className="w-4 h-4 animate-spin" /> : "ارسال برای بررسی"}
                      </button>
                      <button onClick={() => { setShowAdForm(false); setAdFormChannelId(null); setAdFormText(""); setAdFormImage(null); }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!showAdForm && (
                <button onClick={() => setShowAdForm(true)}
                  className="w-full h-12 border-2 border-dashed border-primary/30 text-primary rounded-2xl text-sm font-medium flex items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all active:bg-primary/10">
                  <Plus className="w-4 h-4" />
                  افزودن آگهی جدید
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Payment History ── */}
        {isLoggedIn && (
          <>
            <div className="mx-4 mt-5 h-px bg-border" />
            <div className="mx-4 mt-5">
              <SectionHeader icon={<DollarSign className="w-4 h-4" />} title="تاریخچه پرداخت‌ها" />
            </div>
            <div className="px-4 mt-3 space-y-2">
              {myPaymentsLoading ? (
                <LoadingRow />
              ) : myPayments.length === 0 ? (
                <EmptyRow text="پرداختی ثبت نشده" />
              ) : (
                <AnimatePresence>
                  {myPayments.map((payment) => {
                    const amountTomans = Math.floor(payment.amountRials / 10);
                    const isPending = payment.status === "pending";
                    const isVerified = payment.status === "verified";
                    const urlExpired = payment.paymentUrlExpiresAt
                      ? new Date(payment.paymentUrlExpiresAt) < new Date()
                      : true;
                    const statusLabel = {
                      pending: "در انتظار پرداخت",
                      verified: "پرداخت موفق",
                      failed: "پرداخت ناموفق",
                    }[payment.status] ?? payment.status;
                    const statusStyle = {
                      pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
                      verified: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
                      failed: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
                    }[payment.status] ?? "bg-muted text-muted-foreground border-border";

                    return (
                      <motion.div key={payment.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="bg-card border border-border rounded-2xl px-3.5 py-3 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-flex items-center text-[10px] font-medium border px-1.5 py-0.5 rounded-md ${statusStyle}`}>
                              {statusLabel}
                            </span>
                            <span className="text-sm font-bold text-foreground">
                              {amountTomans.toLocaleString("fa-IR")} تومان
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(payment.createdAt).toLocaleString("fa-IR")}
                          </p>
                          {isPending && payment.paymentUrl && !urlExpired && (
                            <a
                              href={payment.paymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full h-9 bg-primary/10 text-primary border border-primary/20 font-bold rounded-xl text-xs flex items-center justify-center gap-1 hover:bg-primary/15 transition-colors"
                            >
                              ادامه پرداخت
                            </a>
                          )}
                          {isPending && urlExpired && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">
                              لینک پرداخت منقضی شده — برای ثبت آگهی جدید از بخش تبلیغات اقدام کنید.
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </>
        )}

        <div className="mx-4 mt-5 h-px bg-border" />

        {/* ── Image Quality Setting ── */}
        <div className="px-4 pt-5">
          <SectionHeader icon={<Zap className="w-4 h-4" />} title="تنظیمات تصویر" />
          <div className="mt-3 space-y-2">
            <AutoReduceToggle />
          </div>
        </div>

        <div className="mx-4 mt-5 h-px bg-border" />

        {/* ── Saved Styles ── */}
        <div className="px-4 pt-5">
          <SectionHeader icon={<Sparkles className="w-4 h-4" />} title="استایل‌های ذخیره‌شده" count={styles.length} cap={5} />
          <div className="space-y-2 mt-3">
            {stylesLoading ? <LoadingRow /> : styles.length === 0 ? <EmptyRow text="هنوز استایلی ندارید" /> : (
              <AnimatePresence>
                {styles.map(style => (
                  <motion.div key={style.id} layout exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}>
                    <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-3.5 py-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{style.name}</p>
                        <p className="text-[11px] text-muted-foreground">{style.data.objects?.length ?? 0} شیء</p>
                      </div>
                      <button onClick={() => handleDeleteStyle(style.id)} disabled={deletingStyle === style.id}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors disabled:opacity-30">
                        {deletingStyle === style.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <button onClick={() => { enterStyleMode(); setLocation("/editor"); }} disabled={stylesCapped}
              className={`w-full h-12 border-2 border-dashed rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${stylesCapped ? "border-border text-muted-foreground/40 cursor-not-allowed" : "border-primary/30 text-primary hover:border-primary hover:bg-primary/5 active:bg-primary/10"}`}>
              <Plus className="w-4 h-4" />
              {stylesCapped ? "سقف ۵ استایل رسیده‌اید" : "ساخت استایل جدید"}
            </button>
          </div>
        </div>

        <div className="mx-4 my-5 h-px bg-border" />

        {/* ── Logos ── */}
        <div className="px-4">
          <SectionHeader icon={<ImageIcon className="w-4 h-4" />} title="لوگوهای ذخیره‌شده" count={logos.length} cap={5} />
          <div className="mt-3">
            {logosLoading ? <LoadingRow /> : logos.length === 0 ? <EmptyRow text="هنوز لوگویی ذخیره نشده" /> : (
              <div className="grid grid-cols-4 gap-2.5 mb-3">
                <AnimatePresence>
                  {logos.map(logo => (
                    <motion.div key={logo.id} layout exit={{ opacity: 0, scale: 0.8 }} className="relative">
                      <div className="aspect-square rounded-xl border border-border bg-muted overflow-hidden">
                        <img src={logo.data} alt="logo" className="w-full h-full object-contain p-2" />
                      </div>
                      <button onClick={() => handleDeleteLogo(logo.id)} disabled={deletingLogo === logo.id}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center shadow disabled:opacity-40">
                        {deletingLogo === logo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-[10px] leading-none">✕</span>}
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            <input type="file" accept="image/*" ref={logoUploadRef} className="hidden" onChange={handleLogoUpload} />
            <button onClick={() => logoUploadRef.current?.click()} disabled={uploadingLogo || logosCapped}
              className={`w-full h-12 border-2 border-dashed rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${uploadingLogo || logosCapped ? "border-border text-muted-foreground/40 cursor-not-allowed" : "border-orange-500/40 text-orange-600 dark:text-orange-400 hover:border-orange-500 hover:bg-orange-500/5 active:bg-orange-500/10"}`}>
              {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {logosCapped ? "سقف ۵ لوگو رسیده‌اید" : "آپلود لوگو جدید"}
            </button>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">PNG با پس‌زمینه شفاف توصیه می‌شود — حداکثر ۵۰۰ کیلوبایت</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Channel row ────────────────────────────────────────────────────────────────
function ChannelRow({ channel, onCancel, cancelling }: {
  channel: ChannelRecord;
  onCancel?: (id: number) => void;
  cancelling?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const statusStyle = {
    pending:  "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    approved: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    rejected: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  }[channel.status];
  const statusLabel = { pending: "در انتظار بررسی", approved: "تأیید شده", rejected: "رد شده" }[channel.status];
  const StatusIcon = { pending: Clock, approved: Check, rejected: X }[channel.status];

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(p => !p)} className="w-full flex items-center gap-3 px-3.5 py-3 text-right">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground" dir="ltr">@{channel.channelUsername}</p>
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium border px-1.5 py-0.5 rounded-md ${statusStyle}`}>
            <StatusIcon className="w-2.5 h-2.5" />
            {statusLabel}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden border-t border-border">
            <div className="px-3.5 py-3 space-y-2.5 text-xs text-muted-foreground">
              {channel.status === "pending" && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 space-y-1">
                  <p className="font-semibold text-foreground">کد تأیید مالکیت:</p>
                  <p className="font-mono text-lg tracking-widest text-primary" dir="ltr">{channel.verificationCode}</p>
                  <p className="leading-5">این کد را دقیقاً در کانال ایتای خود منتشر کنید تا ادمین مالکیت را تأیید کند.</p>
                </div>
              )}
              {channel.status === "rejected" && channel.reviewNote && (
                <p className="bg-red-500/5 border border-red-500/15 rounded-xl p-3">
                  <span className="font-semibold text-foreground">دلیل رد: </span>{channel.reviewNote}
                </p>
              )}
              <p>لینک: <span dir="ltr" className="text-foreground">{channel.channelLink}</span></p>
              {channel.status === "pending" && onCancel && (
                <button
                  onClick={() => onCancel(channel.id)}
                  disabled={cancelling}
                  className="w-full h-9 flex items-center justify-center gap-1.5 rounded-xl text-xs font-medium text-destructive bg-destructive/5 border border-destructive/20 hover:bg-destructive/10 transition-colors disabled:opacity-40"
                >
                  {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  لغو درخواست
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Auto-reduce toggle ──────────────────────────────────────────────────────
function AutoReduceToggle() {
  const { enabled, toggle } = useAutoReduce();
  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">کاهش خودکار کیفیت</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-4">
          در دستگاه‌های کند، تصاویر بهینه می‌شوند تا ویرایش روان بماند. غیرفعال کردن ممکن است باعث کندی شود.
        </p>
      </div>
      <button
        onClick={toggle}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${enabled ? "bg-primary" : "bg-muted border border-border"}`}
        role="switch"
        aria-checked={enabled}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, count, cap }: {
  icon: React.ReactNode; title: string; count?: number; cap?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-foreground font-bold text-sm">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      {count !== undefined && cap !== undefined && (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${count >= cap ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
          {count}/{cap}
        </span>
      )}
    </div>
  );
}
function LoadingRow() {
  return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
}
function EmptyRow({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground text-center py-5 bg-muted/30 rounded-xl border border-dashed border-border">{text}</p>;
}
