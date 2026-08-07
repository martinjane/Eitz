import React, { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Crop, Maximize2, RotateCcw, FlipHorizontal2, Type, Paintbrush,
  Wand2, Sliders, ImagePlus, Shield, Droplets, Wind, SquareAsterisk, Layers2,
} from "lucide-react";
import { EitashotLogo } from "@/components/EitashotLogo";

// ─── Tool definitions — icons match ToolBar.tsx exactly ─────────────────────
const TOOLS = [
  {
    id: "برش",        Icon: Crop,          label: "برش",
    what:   "بخش دلخواه تصویر را انتخاب و قسمت اضافه را حذف می‌کند.",
    when:   "وقتی تصویر حاشیه‌های اضافی دارد یا می‌خواهید روی یک موضوع تمرکز کنید.",
    how:    "ابزار برش را بزنید. دستگیره‌های گوشه‌ها ظاهر می‌شوند — آن‌ها را بکشید تا ناحیه دلخواه مشخص شود. سپس «اعمال برش» را بزنید.",
    result: "تصویر فقط شامل ناحیه انتخابی می‌شود. عمل قابل واگرد است.",
  },
  {
    id: "تغییر اندازه", Icon: Maximize2,   label: "اندازه",
    what:   "عرض و ارتفاع تصویر را به پیکسل تغییر می‌دهد.",
    when:   "برای رساندن تصویر به ابعاد مشخص — مثلاً ۱۰۸۰×۱۰۸۰ پیکسل.",
    how:    "ابعاد دلخواه را وارد کنید یا از دکمه‌های سریع ۵۰٪ / ۷۵٪ / ۲× استفاده کنید.",
    result: "تصویر به ابعاد جدید کشیده می‌شود. با قفل نسبت تصویر محتوا تغییر شکل نمی‌دهد.",
  },
  {
    id: "چرخش",       Icon: RotateCcw,     label: "چرخش",
    what:   "تصویر را به زاویه دلخواه می‌چرخاند.",
    when:   "وقتی تصویر کج گرفته شده یا باید جهت آن تغییر کند.",
    how:    "دکمه‌های ۹۰/۱۸۰ درجه را بزنید یا اسلایدر زاویه را تنظیم کنید. بعد «اعمال» را بزنید.",
    result: "تصویر با زاویه تنظیم‌شده ذخیره می‌شود. زوایای غیر ۹۰ درجه کمی برش می‌زنند.",
  },
  {
    id: "وارونه",      Icon: FlipHorizontal2, label: "وارونه",
    what:   "تصویر را به‌صورت افقی (آینه) یا عمودی برمی‌گرداند.",
    when:   "وقتی لوگو یا متن در جهت اشتباه است یا عکس سلفی نیاز به آینه‌ای‌شدن دارد.",
    how:    "«افقی» برای آینه‌ای‌کردن چپ/راست، «عمودی» برای برگرداندن بالا/پایین.",
    result: "تصویر بلافاصله برگردانده می‌شود. عمل قابل واگرد است.",
  },
  {
    id: "متن",         Icon: Type,          label: "متن",
    what:   "متن فارسی یا لاتین با فونت، اندازه و رنگ دلخواه اضافه می‌کند.",
    when:   "برای عنوان، توضیح، نقل‌قول یا هر متنی که باید روی تصویر باشد.",
    how:    "متن را بنویسید، اندازه و رنگ را تنظیم کنید، «افزودن متن» را بزنید. با انگشت جابجا کنید.",
    result: "هر متن یک لایه مستقل می‌شود. می‌توانید چند متن اضافه کنید و جداگانه ویرایش کنید.",
  },
  {
    id: "نقاشی",       Icon: Paintbrush,    label: "نقاشی",
    what:   "با انگشت روی تصویر خط می‌کشد. هر ضربه یک لایه مستقل شفاف می‌شود.",
    when:   "برای تأکید، فلش، امضا یا هر حاشیه‌نویسی روی تصویر.",
    how:    "اندازه و رنگ قلم را انتخاب کنید و روی تصویر بکشید. با بلند‌کردن انگشت لایه جدید ثبت می‌شود.",
    result: "هر ضربه لایه شفاف جداگانه‌ای است — روی فیلترهای تصویر اثر ندارد و قابل حذف است.",
  },
  {
    id: "فیلتر",       Icon: Wand2,         label: "فیلتر",
    what:   "یکی از فیلترهای از پیش‌تعریف‌شده را با یک ضربه اعمال می‌کند.",
    when:   "برای تغییر سریع حال‌وهوای تصویر — گرم، سرد، کلاسیک، تیره و غیره.",
    how:    "از ردیف پیش‌نمایش‌های رنگی یک فیلتر انتخاب کنید. پیش‌نمایش بلادرنگ است.",
    result: "فیلتر روی تصویر پایه اعمال می‌شود. می‌توانید هر زمان فیلتر دیگری انتخاب کنید.",
  },
  {
    id: "تنظیمات",     Icon: Sliders,       label: "تنظیمات",
    what:   "روشنایی، کنتراست و اشباع رنگ را با دقت کنترل می‌کند.",
    when:   "وقتی تصویر خیلی تاریک، کم‌رنگ یا کنتراست پایین دارد.",
    how:    "اسلایدرها را تنظیم کنید. «بازنشانی» همه را به پیش‌فرض برمی‌گرداند.",
    result: "تغییرات بلادرنگ نمایش داده می‌شود. غیرمخرب و قابل بازگشت.",
  },
  {
    id: "لوگو",        Icon: Shield,        label: "لوگو",
    what:   "لوگوی برند را به‌عنوان لایه شفاف روی تصویر قرار می‌دهد.",
    when:   "برای هویت بصری کانال — لوگو در گوشه نشانه منبع محتواست.",
    how:    "«افزودن موقت» برای یک‌بار، «ذخیره لوگو» برای استفاده مجدد. با دو انگشت اندازه را تنظیم کنید.",
    result: "لوگو لایه مستقل است. می‌توانید جابجا، تغییر اندازه یا حذف کنید.",
  },
  {
    id: "واترمارک",    Icon: Droplets,      label: "واترمارک",
    what:   "شناسه کانال یا نام برند را به‌عنوان متن شفاف روی تصویر قرار می‌دهد.",
    when:   "برای نشان‌گذاری — مثل @channelname یا eitaa.com/channel.",
    how:    "متن را وارد کنید، شفافیت و موقعیت را انتخاب کنید.",
    result: "متن با شفافیت دلخواه روی تصویر قرار می‌گیرد. مناسب استایل‌های ذخیره‌شده.",
  },
  {
    id: "بلور",        Icon: Wind,          label: "بلور",
    what:   "افکت بلور گاوسی روی کل تصویر اعمال می‌کند.",
    when:   "برای پس‌زمینه محو زیر لایه‌های متن/لوگو یا افکت هنری.",
    how:    "شدت بلور را با اسلایدر تنظیم کنید. «اعمال بلور» را بزنید.",
    result: "بلور روی تصویر پایه اعمال می‌شود. لایه‌های بالایی بلور نمی‌گیرند.",
  },
  {
    id: "کادر",        Icon: SquareAsterisk, label: "کادر",
    what:   "حاشیه رنگی به دور تصویر اضافه می‌کند.",
    when:   "برای جداسازی تصویر یا اضافه‌کردن هویت بصری با رنگ برند.",
    how:    "ضخامت و رنگ حاشیه را انتخاب کنید، «اعمال کادر» را بزنید.",
    result: "حاشیه به ابعاد تصویر اضافه می‌شود.",
  },
  {
    id: "تصویر",       Icon: ImagePlus,     label: "تصویر",
    what:   "یک تصویر دیگر را به‌عنوان لایه روی تصویر اصلی قرار می‌دهد.",
    when:   "برای ترکیب دو تصویر، عکس پروفایل روی پس‌زمینه یا هر کولاژ.",
    how:    "تصویر را انتخاب کنید. با یک انگشت جابجا، با دو انگشت اندازه را تغییر دهید.",
    result: "تصویر افزوده‌شده لایه مستقل است. شفافیت قابل تنظیم.",
  },
  {
    id: "لایه‌ها",     Icon: Layers2,       label: "لایه‌ها",
    what:   "ترتیب، شفافیت و حذف لایه‌های موجود را مدیریت می‌کند.",
    when:   "وقتی چند لایه دارید و می‌خواهید ترتیب یا شفافیت آن‌ها را تغییر دهید.",
    how:    "لایه را در لیست لمس کنید. دکمه‌های ↑↓ ترتیب را تغییر می‌دهند.",
    result: "لایه فعال با کادر انتخاب روی بوم مشخص می‌شود.",
  },
];

// ─── Saved Styles pages (onboarding flow) ────────────────────────────────────
const STYLE_PAGES = [
  {
    illustrationBg: "from-primary/20 to-primary/5",
    illustrationContent: (
      <div className="flex items-center gap-3">
        {[
          { Icon: Shield, c: "bg-primary text-white" },
          { Icon: Droplets, c: "bg-primary/20 text-primary" },
          { Icon: Type, c: "bg-primary/10 text-primary" },
        ].map(({ Icon, c }, i) => (
          <div key={i} className={`w-14 h-14 rounded-2xl ${c} flex items-center justify-center shadow-sm`}>
            <Icon className="w-6 h-6" />
          </div>
        ))}
      </div>
    ),
    title: "استایل ذخیره‌شده چیست؟",
    body: "مجموعه‌ای از دستورالعمل‌ها — موقعیت، اندازه، رنگ، متن و شناسه لوگو — که با یک ضربه روی هر تصویری اعمال می‌شود.\n\nهیچ تصویری در استایل ذخیره نمی‌شود. فقط «دستور چیدمان» حفظ می‌شود تا روی هر عکس جدید بازسازی شود.",
    badge: "چیست؟",
  },
  {
    illustrationBg: "from-amber-500/20 to-amber-400/5",
    illustrationContent: (
      <div className="relative w-44 h-24">
        {/* Simulated image stack */}
        {[0, 1, 2].map(i => (
          <div key={i} className="absolute bg-muted border border-border rounded-xl"
            style={{ width: 80, height: 60, left: i * 22, top: i * 8, opacity: 1 - i * 0.15, zIndex: 3 - i }}>
            <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-md bg-primary/30 flex items-center justify-center">
              <Shield className="w-3 h-3 text-primary" />
            </div>
            <div className="absolute bottom-1.5 left-1.5 w-10 h-1.5 rounded-full bg-foreground/15" />
          </div>
        ))}
        <div className="absolute top-0 left-36 bg-primary text-white rounded-xl px-2 py-1 text-[10px] font-bold shadow">
          ۱ استایل
        </div>
      </div>
    ),
    title: "چرا مفید است؟",
    body: "اگر هر روز برای کانال عکس پست می‌کنید، هر بار لوگو و واترمارک را دستی تنظیم نکنید.\n\nیک بار استایل بسازید — بار بعد فقط عکس را انتخاب کنید و استایل را اعمال کنید. هویت بصری کانال در چند ثانیه آماده است.",
    badge: "چرا؟",
  },
  {
    illustrationBg: "from-green-500/20 to-green-400/5",
    illustrationContent: (
      <div className="space-y-2 w-full max-w-[200px]">
        {[
          { icon: "①", text: "گزینه «استایل ذخیره‌شده» را بزنید", done: true },
          { icon: "②", text: "«ساخت استایل جدید» را انتخاب کنید", done: true },
          { icon: "③", text: "لوگو + واترمارک اضافه کنید", done: false },
        ].map(({ icon, text, done }) => (
          <div key={icon} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-[11px] font-medium ${
            done ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
                 : "bg-card border-border text-foreground"
          }`}>
            <span className="font-bold shrink-0">{icon}</span>
            <span className="leading-tight">{text}</span>
          </div>
        ))}
      </div>
    ),
    title: "چطور می‌سازیم؟",
    body: "از صفحه انتخاب تصویر، «استفاده از استایل ذخیره‌شده» را بزنید، سپس «ساخت استایل جدید».\n\nویرایشگر با یک بوم خالی ۱۰۸۰×۱۰۸۰ باز می‌شود. لوگو، واترمارک یا متن را در موقعیت دلخواه بگذارید. وقتی راضی بودید، استایل را ذخیره کنید.",
    badge: "ساخت",
  },
  {
    illustrationBg: "from-blue-500/20 to-blue-400/5",
    illustrationContent: (
      <div className="relative w-44 h-28">
        <div className="absolute inset-0 bg-muted rounded-2xl border-2 border-border overflow-hidden">
          <div className="absolute inset-0" style={{
            background: "linear-gradient(135deg, hsl(22 30% 75%) 0%, hsl(210 20% 80%) 100%)"
          }} />
          <div className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-primary/80 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="absolute bottom-2 left-2 text-[9px] font-bold text-white/80 bg-black/30 px-1.5 py-0.5 rounded-md">
            @channel
          </div>
        </div>
        <div className="absolute -top-2 -right-2 bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md">
          <Sparkles className="w-3 h-3" />
        </div>
      </div>
    ),
    title: "چطور اعمال می‌کنیم؟",
    body: "تصویر مورد نظر را انتخاب کنید. «استفاده از استایل ذخیره‌شده» را بزنید.\n\nاستایل دلخواه را از لیست انتخاب کنید — اشیاء با موقعیت نسبی روی تصویر جدید بازسازی می‌شوند و می‌توانید ویرایش را ادامه دهید.",
    badge: "اعمال",
  },
  {
    illustrationBg: "from-primary/15 to-accent/10",
    illustrationContent: (
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-primary/15 border-2 border-primary/30 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-[160px]">تا ۵ استایل برای سبک‌های مختلف محتوا ذخیره کنید</p>
      </div>
    ),
    title: "آماده‌اید!",
    body: "استایل‌ها در بخش «تنظیمات» مدیریت می‌شوند. می‌توانید نام، لیست و حذف هر استایل را از آنجا کنترل کنید.\n\nیک نکته: همان هویت بصری را با چند استایل ذخیره کنید — لوگو پایین-راست، واترمارک مرکزی — تا برای هر نوع محتوا استایل مناسب داشته باشید.",
    badge: "شروع!",
    isLast: true,
  },
];

// ─── View type ───────────────────────────────────────────────────────────────
type View = "home" | "tools" | "styles";

export default function Guide() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const _initialTab = new URLSearchParams(search).get("tab");
  const [view, setView] = useState<View>(
    _initialTab === "tools" ? "tools" : _initialTab === "styles" ? "styles" : "home"
  );
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [stylePage, setStylePage] = useState(0);

  const selectedTool = TOOLS.find(t => t.id === selectedToolId) ?? null;
  const inToolDetail = view === "tools" && selectedToolId !== null;

  const handleBack = () => {
    if (view === "styles") { setView("home"); setStylePage(0); return; }
    if (inToolDetail) { setSelectedToolId(null); return; }
    setView("home");
  };

  const showHeader = true; // always
  const showBackArrow = view !== "home" || inToolDetail;

  return (
    <div className="min-h-dvh w-full max-w-[520px] mx-auto flex flex-col bg-background overflow-hidden select-none" dir="rtl">
      {/* ── Header ── */}
      <header className="h-13 bg-card border-b border-border flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          {inToolDetail ? (
            /* Back arrow — small, left-corner, goes to home */
            <motion.button
              key="back-arrow"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={handleBack}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </motion.button>
          ) : (
            <EitashotLogo size={24} />
          )}
          <span className="font-bold text-sm text-foreground">راهنما</span>
        </div>
        <button
          onClick={() => {
            if (view === "home") setLocation("/");
            else handleBack();
          }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      {/* ── Styles onboarding ── */}
      <AnimatePresence mode="wait">
        {view === "styles" && (
          <motion.div
            key="styles-view"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className="flex-1 flex flex-col"
          >
            <StylesOnboarding
              page={stylePage}
              total={STYLE_PAGES.length}
              onNext={() => {
                if (stylePage < STYLE_PAGES.length - 1) setStylePage(p => p + 1);
                else { setView("home"); setStylePage(0); }
              }}
              onPrev={() => {
                if (stylePage > 0) setStylePage(p => p - 1);
                else setView("home");
              }}
              onDone={() => { setView("home"); setStylePage(0); }}
            />
          </motion.div>
        )}

        {/* ── Home + Tools view ── */}
        {view !== "styles" && (
          <motion.div
            key="main-view"
            className="flex-1 flex flex-col min-h-0"
            initial={false}
          >
            {/* Main content area */}
            <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 min-h-0 overflow-y-auto">
              <AnimatePresence mode="wait">
                {!inToolDetail ? (
                  /* Home / tool-list state — show the two main buttons */
                  <motion.div
                    key="home-btns"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22 }}
                    className="w-full max-w-sm space-y-4"
                  >
                    <p className="text-center text-xs text-muted-foreground mb-6">
                      یک بخش را انتخاب کنید تا بیشتر بدانید
                    </p>

                    {/* Image Editor button */}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setView("tools")}
                      className={`w-full rounded-2xl border-2 transition-all text-right p-4 flex items-center gap-4 ${
                        view === "tools"
                          ? "border-primary bg-primary/8 shadow-md ring-2 ring-primary/20"
                          : "border-border bg-card hover:border-primary/40 hover:bg-primary/4"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        view === "tools" ? "bg-primary text-white" : "bg-primary/10 text-primary"
                      }`}>
                        <Paintbrush className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold text-base ${view === "tools" ? "text-primary" : "text-foreground"}`}>
                          ابزارهای ویرایشگر
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {TOOLS.length} ابزار — نحوه استفاده از هر ابزار را ببینید
                        </p>
                      </div>
                      {view === "tools" && (
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                      )}
                    </motion.button>

                    {/* Saved Styles button */}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setView("styles"); setStylePage(0); }}
                      className="w-full rounded-2xl border-2 border-border bg-card hover:border-primary/40 hover:bg-primary/4 transition-all text-right p-4 flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-xl bg-accent/20 text-accent-foreground flex items-center justify-center shrink-0">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-base text-foreground">استایل‌های ذخیره‌شده</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          چطور استایل بسازیم، اعمال کنیم و مدیریت کنیم
                        </p>
                      </div>
                    </motion.button>
                  </motion.div>
                ) : (
                  /* Tool detail state */
                  <motion.div
                    key={`tool-${selectedToolId}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-sm space-y-4"
                  >
                    {selectedTool && <ToolDetail tool={selectedTool} />}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tool card row — only visible when tools view is open */}
            <AnimatePresence>
              {view === "tools" && (
                <motion.div
                  key="tool-cards"
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 80, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 340, damping: 30 }}
                  className="shrink-0 border-t border-border bg-card"
                >
                  <p className="text-[10px] text-muted-foreground text-center pt-2 pb-0.5">
                    {inToolDetail ? "ابزار دیگری انتخاب کنید" : "روی یک ابزار بزنید"}
                  </p>
                  <div className="flex gap-2 overflow-x-auto px-3 pb-3 pt-1.5 no-scrollbar">
                    {TOOLS.map(tool => {
                      const Icon = tool.Icon;
                      const isSelected = selectedToolId === tool.id;
                      return (
                        <button
                          key={tool.id}
                          onClick={() => setSelectedToolId(tool.id)}
                          className={`shrink-0 w-[58px] h-[54px] rounded-xl flex flex-col items-center justify-center gap-1 border transition-all ${
                            isSelected
                              ? "border-primary bg-primary text-white shadow-md"
                              : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          <Icon className="w-[18px] h-[18px]" />
                          <span className="text-[9px] font-semibold leading-none">{tool.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tool detail card ────────────────────────────────────────────────────────
function ToolDetail({ tool }: { tool: typeof TOOLS[0] }) {
  const Icon = tool.Icon;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
          <Icon className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{tool.label}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{tool.what}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <InfoRow accent="blue" label="چه زمانی؟" text={tool.when} />
        <InfoRow accent="primary" label="نحوه استفاده" text={tool.how} />
        <InfoRow accent="green" label="نتیجه" text={tool.result} />
      </div>
    </div>
  );
}

function InfoRow({ label, text, accent }: { label: string; text: string; accent: "primary" | "blue" | "green" }) {
  const bar =
    accent === "primary" ? "bg-primary" :
    accent === "blue"    ? "bg-blue-500" : "bg-green-500";
  const labelColor =
    accent === "primary" ? "text-primary" :
    accent === "blue"    ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400";
  return (
    <div className="flex gap-3 bg-card border border-border rounded-xl p-3">
      <div className={`w-1 rounded-full shrink-0 self-stretch ${bar} opacity-60`} />
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${labelColor}`}>{label}</p>
        <p className="text-xs text-foreground leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

// ─── Styles onboarding ────────────────────────────────────────────────────────
function StylesOnboarding({
  page, total, onNext, onPrev, onDone,
}: {
  page: number; total: number; onNext: () => void; onPrev: () => void; onDone: () => void;
}) {
  const p = STYLE_PAGES[page];

  return (
    <div className="flex-1 flex flex-col">
      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 pt-3 pb-1">
        {STYLE_PAGES.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === page ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-border"
            }`}
          />
        ))}
      </div>

      {/* Page content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className="flex-1 flex flex-col px-5 py-4"
        >
          {/* Badge */}
          <div className="mb-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              {p.badge}
            </span>
          </div>

          {/* Illustration */}
          <div className={`w-full rounded-3xl bg-gradient-to-br ${p.illustrationBg} border border-border flex items-center justify-center py-8 mb-5`}>
            {p.illustrationContent}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground mb-3">{p.title}</h2>

          {/* Body */}
          <div className="flex-1">
            {p.body.split("\n\n").map((para, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-3">{para}</p>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="px-5 pb-6 pt-2 flex items-center gap-3">
        <button
          onClick={onPrev}
          className="w-11 h-11 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <button
          onClick={p.isLast ? onDone : onNext}
          className="flex-1 h-11 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm active:opacity-90 transition-opacity"
        >
          {p.isLast ? "بازگشت به راهنما" : "بعدی"}
          {!p.isLast && <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
