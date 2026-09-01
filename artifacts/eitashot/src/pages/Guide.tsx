import React, { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Crop, Maximize2, RotateCcw, FlipHorizontal2, Type, Paintbrush,
  Wand2, Sliders, ImagePlus, Shield, Droplets, Wind, SquareAsterisk, Layers2,
  LayoutGrid,
} from "lucide-react";
import { EitashotLogo } from "@/components/EitashotLogo";

// ─── ToolPage type ──────────────────────────────────────────────────────────
type ToolPage = {
  badge: string;
  title: string;
  illustrationBg: string;
  illustrationContent: React.ReactNode;
  body: string;
};

type ToolDef = {
  id: string;
  Icon: typeof Crop;
  label: string;
  what: string;
  pages: ToolPage[];
};

// ─── Tool definitions — multi-page guides with human-friendly text ──────────
const TOOLS: ToolDef[] = [
  {
    id: "برش", Icon: Crop, label: "برش",
    what: "بیرون‌ترین بخش تصویر را ببُرید و فقط قسمتی که می‌خواهید نگه دارید.",
    pages: [
      {
        badge: "ابزار",
        title: "ابزار برش چیست؟",
        illustrationBg: "from-primary/20 to-primary/5",
        illustrationContent: (
          <div className="relative w-36 h-24">
            <div className="absolute inset-0 bg-muted rounded-xl border border-border overflow-hidden">
              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(22 30% 75%) 0%, hsl(210 20% 80%) 100%)" }} />
              <div className="absolute inset-2 border-2 border-dashed border-primary/60 rounded-lg" />
              <div className="absolute top-1 left-1 w-3 h-3 border-l-2 border-t-2 border-primary rounded-tl-sm" />
              <div className="absolute top-1 right-1 w-3 h-3 border-r-2 border-t-2 border-primary rounded-tr-sm" />
              <div className="absolute bottom-1 left-1 w-3 h-3 border-l-2 border-b-2 border-primary rounded-bl-sm" />
              <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-primary rounded-br-sm" />
            </div>
          </div>
        ),
        body: "بعضی وقت‌ها عکس‌تان حاشیه‌های اضافی دارد یا می‌خواهید فقط بخشی از آن را نگه دارید.\n\nابزار برش به شما اجازه می‌دهد ناحیه دلخواه را انتخاب کنید و بقیه را دور بریزید.",
      },
      {
        badge: "نحوه استفاده",
        title: "چطور برش بزنیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Crop className="w-6 h-6 text-primary" />
            </div>
            <div className="text-lg text-muted-foreground">→</div>
            <div className="w-14 h-14 rounded-xl bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
              <span className="text-xs font-bold text-green-700 dark:text-green-400">برش!</span>
            </div>
          </div>
        ),
        body: "دستگیره‌های گوشه‌ها را بکشید تا ناحیه مورد نظر مشخص شود.\n\nوقتی راضی شدید، «اعمال برش» را بزنید. تصویر فقط همان بخش را نگه می‌دارد.\n\nاگر پشیمان شدید، بازگشت کنید — هیچ چیزی برای همیشه حذف نمی‌شود!",
      },
    ],
  },
  {
    id: "تغییر اندازه", Icon: Maximize2, label: "اندازه",
    what: "اندازه تصویر را بزرگ‌تر یا کوچک‌تر کنید.",
    pages: [
      {
        badge: "ابزار",
        title: "تغییر اندازه چیست؟",
        illustrationBg: "from-blue-500/20 to-blue-400/5",
        illustrationContent: (
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30" />
            <div className="w-12 h-12 rounded-lg bg-blue-500/15 border border-blue-500/25" />
            <div className="w-16 h-16 rounded-lg bg-blue-500/10 border border-blue-500/20" />
          </div>
        ),
        body: "گاهی اوقات عکس خیلی بزرگ است و فضای زیادی اشغال می‌کند، یا خیلی کوچک است و کیفیتش پایین می‌آید.\n\nبا این ابزار می‌توانید عرض و ارتفاع تصویر را به پیکسل دلخواه تغییر دهید.",
      },
      {
        badge: "نحوه استفاده",
        title: "اندازه را چطور عوض کنیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="space-y-2 w-full max-w-[180px]">
            {["۱۰۸۰ × ۱۰۸۰ پیکسل", "۷۵٪ اندازه اصلی", "۲ برابر بزرگ‌تر"].map((t, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border bg-card border-border text-[11px] font-medium text-foreground">
                <span className="text-primary font-bold">✓</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        ),
        body: "ابعاد مورد نظر را وارد کنید. یا از دکمه‌های سریع ۵۰٪ / ۷۵٪ / ۲× استفاده کنید.\n\nقفل نسبت تصویر فعال است، پس محتوا کج یا کشیده نمی‌شود.",
      },
    ],
  },
  {
    id: "چرخش", Icon: RotateCcw, label: "چرخش",
    what: "تصویر را به هر زاویه‌ای بچرخانید.",
    pages: [
      {
        badge: "ابزار",
        title: "چرخش چیست؟",
        illustrationBg: "from-amber-500/20 to-amber-400/5",
        illustrationContent: (
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 bg-amber-500/15 border border-amber-500/30 rounded-xl rotate-12" />
            <div className="absolute inset-0 bg-amber-500/10 border border-amber-500/20 rounded-xl -rotate-6" />
            <div className="absolute inset-0 flex items-center justify-center">
              <RotateCcw className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        ),
        body: "بعضی عکس‌ها کج گرفته شده‌اند یا می‌خواهید جهتشان را عوض کنید.\n\nبا این ابزار می‌توانید تصویر را به هر زاویه‌ای بچرخانید — از ۹۰ درجه گرفته تا زاویه‌های دقیق.",
      },
      {
        badge: "نحوه استفاده",
        title: "چطور بچرخانیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="flex items-center gap-2">
            {["۹۰°", "۱۸۰°", "۲۷۰°"].map((d, i) => (
              <div key={i} className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{d}</span>
              </div>
            ))}
          </div>
        ),
        body: "دکمه‌های ۹۰ / ۱۸۰ درجه را بزنید یا اسلایدر زاویه را تنظیم کنید.\n\nبعد «اعمال» را بزنید. توجه داشته باشید زوایای غیر ۹۰ درجه کمی از گوشه‌ها بریده می‌شوند.",
      },
    ],
  },
  {
    id: "وارونه", Icon: FlipHorizontal2, label: "وارونه",
    what: "تصویر را آینه‌ای کنید یا از بالا به پایین برگردانید.",
    pages: [
      {
        badge: "ابزار",
        title: "وارونه چیست؟",
        illustrationBg: "from-violet-500/20 to-violet-400/5",
        illustrationContent: (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <span className="text-2xl">🙂</span>
            </div>
            <div className="text-violet-500">⇄</div>
            <div className="w-14 h-14 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center" style={{ transform: "scaleX(-1)" }}>
              <span className="text-2xl">🙂</span>
            </div>
          </div>
        ),
        body: "گاهی اوقات متن یا لوگو در جهت اشتباه قرار گرفته، یا عکس سلفی نیاز به آینه‌ای شدن دارد.\n\nبا این ابزار می‌توانید تصویر را چپ-راست یا بالا-پایین برگردانید.",
      },
      {
        badge: "نحوه استفاده",
        title: "چطور وارونه کنیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <span className="text-xs font-bold text-primary">افقی</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <span className="text-xs font-bold text-primary">عمودی</span>
            </div>
          </div>
        ),
        body: "«افقی» تصویر را آینه‌ای می‌کند (چپ و راست عوض می‌شود).\n\n«عمودی» تصویر را از بالا به پایین برمی‌گرداند.\n\nهر دو فوری اعمال می‌شوند و قابل بازگشت هستند.",
      },
    ],
  },
  {
    id: "متن", Icon: Type, label: "متن",
    what: "هر متنی که می‌خواهید را روی تصویر بنویسید.",
    pages: [
      {
        badge: "ابزار",
        title: "افزودن متن چیست؟",
        illustrationBg: "from-primary/20 to-primary/5",
        illustrationContent: (
          <div className="w-36 h-20 rounded-xl bg-muted border border-border flex items-center justify-center relative">
            <span className="text-lg font-bold text-foreground/80">متن نمونه</span>
            <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center">
              <Type className="w-3 h-3" />
            </div>
          </div>
        ),
        body: "بعضی وقت‌ها لازم است عنوان، توضیح یا نقل‌قولی روی عکس بنویسید.\n\nبا این ابزار می‌توانید متن فارسی یا لاتین با فونت، اندازه و رنگ دلخواه اضافه کنید.",
      },
      {
        badge: "نحوه استفاده",
        title: "متن را چطور اضافه کنیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="space-y-2 w-full max-w-[180px]">
            {[
              { icon: "①", text: "متن را بنویسید", done: true },
              { icon: "②", text: "اندازه و رنگ را تنظیم کنید", done: true },
              { icon: "③", text: "«افزودن متن» را بزنید", done: false },
            ].map(({ icon, text, done }) => (
              <div key={icon} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium ${
                done ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
                     : "bg-card border-border text-foreground"
              }`}>
                <span className="font-bold shrink-0">{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        ),
        body: "متن را تایپ کنید و اندازه و رنگش را انتخاب کنید. «افزودن متن» را بزنید.\n\nهر متن مثل یک لایه مستقل است — می‌توانید با انگشت آن را جابجا کنید.\n\nچند متن می‌توانید اضافه کنید و هر کدام را جداگانه ویرایش کنید.",
      },
    ],
  },
  {
    id: "نقاشی", Icon: Paintbrush, label: "نقاشی",
    what: "با انگشت روی تصویر نقاشی کنید.",
    pages: [
      {
        badge: "ابزار",
        title: "نقاشی چیست؟",
        illustrationBg: "from-rose-500/20 to-rose-400/5",
        illustrationContent: (
          <div className="relative w-32 h-20">
            <div className="absolute inset-0 bg-rose-500/10 rounded-xl border border-rose-500/20" />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 128 80">
              <path d="M20 60 Q40 20 60 50 T100 30" fill="none" stroke="hsl(350 70% 55%)" strokeWidth="3" strokeLinecap="round" />
              <path d="M30 70 Q50 40 80 55" fill="none" stroke="hsl(22 88% 47%)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        ),
        body: "بعضی وقت‌ها می‌خواهید دستی روی عکس چیزی بکشید — یک فلش، امضا، یا تأکید.\n\nبا ابزار نقاشی می‌توانید با انگشت خط بکشید. هر ضربه یک لایه جداگانه می‌شود.",
      },
      {
        badge: "نحوه استفاده",
        title: "چطور نقاشی کنیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="flex items-center gap-2">
            {["bg-rose-500", "bg-primary", "bg-blue-500", "bg-green-500"].map((c, i) => (
              <div key={i} className={`w-8 h-8 rounded-full ${c} border-2 border-white/50`} />
            ))}
          </div>
        ),
        body: "اندازه و رنگ قلم را انتخاب کنید و روی تصویر بکشید.\n\nوقتی انگشت را بلند کنید، ضربه به صورت یک لایه شفاف جداگانه ذخیره می‌شود.\n\nروی فیلترها اثر ندارد و هر وقت خواستید حذفش کنید.",
      },
    ],
  },
  {
    id: "فیلتر", Icon: Wand2, label: "فیلتر",
    what: "با یک ضربه حال‌وهوای تصویر را عوض کنید.",
    pages: [
      {
        badge: "ابزار",
        title: "فیلتر چیست؟",
        illustrationBg: "from-purple-500/20 to-purple-400/5",
        illustrationContent: (
          <div className="flex gap-1.5">
            {[
              "linear-gradient(135deg, hsl(22 80% 60%), hsl(35 90% 55%))",
              "linear-gradient(135deg, hsl(210 40% 70%), hsl(190 30% 65%))",
              "linear-gradient(135deg, hsl(0 0% 40%), hsl(220 10% 50%))",
              "linear-gradient(135deg, hsl(45 60% 65%), hsl(30 50% 60%))",
            ].map((bg, i) => (
              <div key={i} className="w-10 h-14 rounded-xl border border-border" style={{ background: bg }} />
            ))}
          </div>
        ),
        body: "فیلترها راه سریعی برای تغییر حال‌وهوای عکس هستند — گرم، سرد، کلاسیک، تیره و غیره.\n\nنیازی به تنظیم دستی نیست؛ یکی را انتخاب کنید و بلافاصله نتیجه را ببینید.",
      },
      {
        badge: "نحوه استفاده",
        title: "فیلتر را چطور اعمال کنیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="w-32 h-20 rounded-xl bg-muted border-2 border-primary/40 overflow-hidden relative">
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(22 60% 70%) 0%, hsl(210 40% 75%) 100%)" }} />
            <div className="absolute bottom-1 right-1 bg-primary text-white rounded-md px-1.5 py-0.5 text-[9px] font-bold">
              فیلتر
            </div>
          </div>
        ),
        body: "از ردیف پیش‌نمایش‌های رنگی، هر فیلتری که دوست دارید را لمس کنید.\n\nپیش‌نمایش بلادرنگ است، یعنی همان لحظه نتیجه را روی تصویر می‌بینید.\n\nمی‌توانید هر زمان فیلتر دیگری انتخاب کنید.",
      },
    ],
  },
  {
    id: "تنظیمات", Icon: Sliders, label: "تنظیمات",
    what: "روشنایی، رنگ و کنتراست تصویر را دستی تنظیم کنید.",
    pages: [
      {
        badge: "ابزار",
        title: "تنظیمات پیشرفته چیست؟",
        illustrationBg: "from-emerald-500/20 to-emerald-400/5",
        illustrationContent: (
          <div className="space-y-2 w-full max-w-[160px]">
            {[
              { label: "روشنایی", value: 65 },
              { label: "کنتراست", value: 50 },
              { label: "اشباع", value: 72 },
            ].map(({ label, value }, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-14 text-left">{label}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        ),
        body: "فیلترها خوب هستند ولی گاهی لازم است دقیق‌تر تنظیم کنید.\n\nاین ابزار سه اسلایدر دارد: روشنایی برای تاریک/روشن کردن، کنتراست برای تفکیک بهتر رنگ‌ها، و اشباع برای زیاد/کم کردن شدت رنگ‌ها.",
      },
      {
        badge: "نحوه استفاده",
        title: "تنظیمات را چطور تغییر دهیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="flex items-center gap-3">
            <div className="w-20 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-lg text-muted-foreground">→</div>
            <div className="w-20 h-14 rounded-xl bg-gradient-to-br from-emerald-500/15 to-primary/15 border border-emerald-500/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">تصویر بهتر</span>
            </div>
          </div>
        ),
        body: "اسلایدرها را به چپ و راست بکشید تا تغییر را همان لحظه ببینید.\n\nاگر زیاده‌روی کردید، دکمه «بازنشانی» همه چیز را به حالت اول برمی‌گرداند.\n\nتغییرات غیرمخرب هستند — یعنی تصویر اصلی هیچوقت خراب نمی‌شود.",
      },
    ],
  },
  {
    id: "لوگو", Icon: Shield, label: "لوگو",
    what: "لوگوی برند یا کانال را روی تصویر بگذارید.",
    pages: [
      {
        badge: "ابزار",
        title: "لوگو چیست؟",
        illustrationBg: "from-primary/20 to-primary/5",
        illustrationContent: (
          <div className="w-32 h-20 rounded-xl bg-muted border border-border relative">
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(22 30% 75%) 0%, hsl(210 20% 80%) 100%)" }} />
            <div className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-lg bg-primary/80 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
          </div>
        ),
        body: "اگر برای کانال پست می‌گذارید، لوگو کمک می‌کند همه بدانند محتوا از کجاست.\n\nلوگو به‌عنوان یک لایه شفاف روی تصویر قرار می‌گیرد و می‌توانید جایش را عوض کنید.",
      },
      {
        badge: "نحوه استفاده",
        title: "لوگو را چطور اضافه کنیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="space-y-2 w-full max-w-[180px]">
            {[
              { icon: "①", text: "«افزودن موقت» یا «ذخیره لوگو»", done: true },
              { icon: "②", text: "لوگو را جابجا کنید", done: false },
              { icon: "③", text: "با دو انگشت اندازه تنظیم کنید", done: false },
            ].map(({ icon, text, done }) => (
              <div key={icon} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium ${
                done ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
                     : "bg-card border-border text-foreground"
              }`}>
                <span className="font-bold shrink-0">{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        ),
        body: "«افزودن موقت» برای یک‌بار استفاده، «ذخیره لوگو» برای دفعات بعد.\n\nلوگو لایه مستقلی است — با انگشت جابجاش کنید و با دو انگشت سایزش را تنظیم کنید.\n\nهر وقت خواستید حذفش کنید.",
      },
    ],
  },
  {
    id: "واترمارک", Icon: Droplets, label: "واترمارک",
    what: "نام کانال را به صورت متن شفاف روی تصویر بگذارید.",
    pages: [
      {
        badge: "ابزار",
        title: "واترمارک چیست؟",
        illustrationBg: "from-cyan-500/20 to-cyan-400/5",
        illustrationContent: (
          <div className="w-32 h-20 rounded-xl bg-muted border border-border relative overflow-hidden">
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(22 30% 75%) 0%, hsl(210 20% 80%) 100%)" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-foreground/20 rotate-[-15deg]">@channel</span>
            </div>
          </div>
        ),
        body: "واترمارک متنی شفاف است که روی تصویر قرار می‌گیرد تا نشان دهد محتوا متعلق به کانال شماست.\n\nمثلاً @channelname یا eitaa.com/channel.",
      },
      {
        badge: "نحوه استفاده",
        title: "واترمارک را چطور تنظیم کنیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="w-32 h-20 rounded-xl bg-muted border border-border relative overflow-hidden">
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(22 30% 75%) 0%, hsl(210 20% 80%) 100%)" }} />
            <div className="absolute bottom-2 left-2 text-[9px] font-bold text-white/60 bg-black/20 px-1.5 py-0.5 rounded-md">
              @channel
            </div>
          </div>
        ),
        body: "متن مورد نظر را تایپ کنید. شفافیت و موقعیت آن را تنظیم کنید.\n\nمی‌توانید واترمارک را در استایل‌های ذخیره‌شده هم بگذارید تا هر بار اضافه نکنید.",
      },
    ],
  },
  {
    id: "بلور", Icon: Wind, label: "بلور",
    what: "پس‌زمینه را محو کنید یا افکت هنری بزنید.",
    pages: [
      {
        badge: "ابزار",
        title: "بلور چیست؟",
        illustrationBg: "from-teal-500/20 to-teal-400/5",
        illustrationContent: (
          <div className="w-32 h-20 rounded-xl border border-border overflow-hidden relative">
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(22 30% 75%) 0%, hsl(210 20% 80%) 100%)" }} />
            <div className="absolute inset-0" style={{ filter: "blur(4px)" }} />
          </div>
        ),
        body: "بلور پیکسل‌های تصویر را محو می‌کند. می‌توانید پس‌زمینه را تار کنید تا متن یا لوگوی رویش بهتر دیده شود.\n\nیا از آن به عنوان یک افکت هنری استفاده کنید.",
      },
      {
        badge: "نحوه استفاده",
        title: "بلور را چطور اعمال کنیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="w-full max-w-[160px] space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-12">شدت</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: "45%" }} />
              </div>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-primary text-white text-[11px] font-bold text-center">
              اعمال بلور
            </div>
          </div>
        ),
        body: "شدت بلور را با اسلایدر تنظیم کنید. هرچه بیشتر بکشید، تصویر بیشتر محو می‌شود.\n\n«اعمال بلور» را بزنید. لایه‌های بالایی (متن، لوگو) بلور نمی‌گیرند — فقط تصویر پایه تغییر می‌کند.",
      },
    ],
  },
  {
    id: "کادر", Icon: SquareAsterisk, label: "کادر",
    what: "حاشیه رنگی به دور تصویر اضافه کنید.",
    pages: [
      {
        badge: "ابزار",
        title: "کادر چیست؟",
        illustrationBg: "from-orange-500/20 to-orange-400/5",
        illustrationContent: (
          <div className="w-28 h-18 rounded-xl bg-muted border-4 border-primary/60 p-1">
            <div className="w-full h-full rounded-lg" style={{ background: "linear-gradient(135deg, hsl(22 30% 75%) 0%, hsl(210 20% 80%) 100%)" }} />
          </div>
        ),
        body: "یک حاشیه رنگی به دور تصویر اضافه کنید تا از بقیه محتوا جدا شود یا هویت بصری کانال را تقویت کند.\n\nضخامت و رنگ کادر را خودتان انتخاب می‌کنید.",
      },
      {
        badge: "نحوه استفاده",
        title: "کادر را چطور اضافه کنیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="flex items-center gap-2">
            {["bg-primary", "bg-green-500", "bg-blue-500", "bg-foreground"].map((c, i) => (
              <div key={i} className={`w-8 h-8 rounded-lg ${c} border-2 border-white/50`} />
            ))}
          </div>
        ),
        body: "ضخامت و رنگ حاشیه را انتخاب کنید.\n\n«اعمال کادر» را بزنید. حاشیه به ابعاد تصویر اضافه می‌شود و تصویر اصلی تغییر نمی‌کند.",
      },
    ],
  },
  {
    id: "تصویر", Icon: ImagePlus, label: "تصویر",
    what: "یک عکس دیگر را روی تصویر اصلی بگذارید.",
    pages: [
      {
        badge: "ابزار",
        title: "افزودن تصویر چیست؟",
        illustrationBg: "from-pink-500/20 to-pink-400/5",
        illustrationContent: (
          <div className="relative w-28 h-20">
            <div className="absolute bottom-0 left-0 w-20 h-14 rounded-xl bg-pink-500/15 border border-pink-500/25" />
            <div className="absolute top-0 right-0 w-16 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 shadow-lg" />
            <div className="absolute top-0 right-0 w-16 h-12 rounded-xl flex items-center justify-center">
              <ImagePlus className="w-5 h-5 text-pink-500" />
            </div>
          </div>
        ),
        body: "گاهی اوقات می‌خواهید دو تصویر را کنار هم یا روی هم بگذارید — مثلاً عکس پروفایل روی یک پس‌زمینه.\n\nبا این ابزار یک تصویر دیگر به‌عنوان لایه جدید اضافه می‌کنید.",
      },
      {
        badge: "نحوه استفاده",
        title: "تصویر را چطور اضافه کنیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="space-y-2 w-full max-w-[180px]">
            {[
              { icon: "①", text: "تصویر را از گالری انتخاب کنید", done: true },
              { icon: "②", text: "با یک انگشت جابجاش کنید", done: false },
              { icon: "③", text: "با دو انگشت سایزش را تنظیم کنید", done: false },
            ].map(({ icon, text, done }) => (
              <div key={icon} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium ${
                done ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
                     : "bg-card border-border text-foreground"
              }`}>
                <span className="font-bold shrink-0">{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        ),
        body: "تصویر مورد نظر را انتخاب کنید. با یک انگشت آن را جابجا کنید و با دو انگشت سایزش را تنظیم کنید.\n\nهر تصویر یک لایه مستقل است. شفافیتش هم قابل تنظیم است.",
      },
    ],
  },
  {
    id: "لایه‌ها", Icon: Layers2, label: "لایه‌ها",
    what: "ترتیب و شفافیت لایه‌های روی تصویر را مدیریت کنید.",
    pages: [
      {
        badge: "ابزار",
        title: "مدیریت لایه‌ها چیست؟",
        illustrationBg: "from-slate-500/20 to-slate-400/5",
        illustrationContent: (
          <div className="relative w-28 h-20">
            {[0, 1, 2].map(i => (
              <div key={i} className="absolute bg-muted border border-border rounded-lg"
                style={{ width: 70, height: 40, left: 8 + i * 4, top: i * 10, opacity: 1 - i * 0.2, zIndex: 3 - i }}>
                <div className="absolute bottom-1 right-1 w-4 h-4 rounded bg-primary/30 flex items-center justify-center">
                  <Layers2 className="w-2.5 h-2.5 text-primary" />
                </div>
              </div>
            ))}
          </div>
        ),
        body: "وقتی چند لایه روی تصویر دارید (متن، لوگو، تصویر اضافه‌شده و...) لایه‌ها ممکن است روی هم بیفتند.\n\nبا این ابزار می‌توانید ترتیبشان را عوض کنید، شفافیت را تنظیم کنید یا لایه‌های اضافی را حذف کنید.",
      },
      {
        badge: "نحوه استفاده",
        title: "لایه‌ها را چطور مدیریت کنیم؟",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="space-y-1.5 w-full max-w-[180px]">
            {["متن: سلام", "لوگو", "واترمارک"].map((name, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-card border border-border text-[11px] font-medium text-foreground">
                <Layers2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="flex-1">{name}</span>
                <span className="text-muted-foreground text-[10px]">↑↓</span>
              </div>
            ))}
          </div>
        ),
        body: "لایه‌ها را در لیست ببینید. روی هر کدام لمس کنید تا انتخاب شود.\n\nدکمه‌های ↑↓ ترتیب را تغییر می‌دهند — لایه بالایی جلوتر دیده می‌شود.\n\nلایه فعال با کادر انتخاب روی تصویر مشخص می‌شود.",
      },
    ],
  },
  {
    id: "اتصال تصاویر", Icon: LayoutGrid, label: "اتصال تصاویر",
    what: "چند تصویر را کنار هم بگذارید و یک عکس واحد بسازید.",
    pages: [
      {
        badge: "شبکه",
        title: "بلوک‌ها و شبکه",
        illustrationBg: "from-primary/20 to-primary/5",
        illustrationContent: (
          <div className="grid grid-cols-2 gap-1.5 w-32">
            {["bg-primary text-white", "bg-muted border border-border", "bg-muted border border-border", "bg-primary/20 border border-primary/30"].map((c, i) => (
              <div key={i} className={`aspect-square rounded-xl ${c} flex items-center justify-center`}
                style={{ opacity: i === 0 ? 1 : 0.7 }}>
                {i === 0 && <LayoutGrid className="w-5 h-5" />}
              </div>
            ))}
          </div>
        ),
        body: "وقتی می‌خواهید چند عکس را کنار هم بگذارید، این ابزار یک شبکه بلوکی در اختیارتان می‌گذارد.\n\nهر بلوک می‌تواند یک تصویر داشته باشد یا خالی باشد. بلوک‌ها را لمس کنید تا انتخاب شوند.",
      },
      {
        badge: "ادغام و خروجی",
        title: "ادغام بلوک‌ها و خروجی نهایی",
        illustrationBg: "from-green-500/20 to-green-400/5",
        illustrationContent: (
          <div className="flex items-center gap-2">
            <div className="w-14 h-14 rounded-xl bg-primary text-white flex items-center justify-center">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div className="text-lg text-muted-foreground">→</div>
            <div className="w-20 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-green-500/20 border-2 border-green-500/40 flex items-center justify-center">
              <span className="text-xs font-bold text-green-700 dark:text-green-400">تصویر واحد</span>
            </div>
          </div>
        ),
        body: "دو بلوک کناری را انتخاب کنید و با دکمه ادغام (فلش) آن‌ها را به هم بچسبانید.\n\n«ردیف اضافه» به شما اجازه می‌دهد ردیف یا ستون جدید به شبکه اضافه کنید.\n\nوقتی راضی شدید، «اعمال اتصال» را بزنید تا یک تصویر واحد ساخته شود.",
      },
    ],
  },
];

// ─── Saved Styles pages (onboarding flow) — human-friendly text ────────────
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
    body: "فرض کنید هر روز برای کانالتان عکس پست می‌کنید و هر بار لوگو و واترمارک را دستی اضافه می‌کنید. خسته‌کننده است!\n\nاستایل ذخیره‌شده مثل یک قالب آماده است — یک بار لوگو و واترمارک را تنظیم کنید، بار بعد فقط عکستان را انتخاب کنید.",
    badge: "چیست؟",
  },
  {
    illustrationBg: "from-amber-500/20 to-amber-400/5",
    illustrationContent: (
      <div className="relative w-44 h-24">
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
    body: "اگر روزی ۵ تا ۱۰ عکس پست می‌کنید، هر بار ۲ دقیقه صرف لوگو و واترمارک می‌کنید — روزی ۱۰ تا ۲۰ دقیقه!\n\nبا استایل ذخیره‌شده، این کار را یک‌بار انجام می‌دهید و بعد فقط عکس را انتخاب و استایل را اعمال می‌کنید. هویت بصری کانالتان همیشه یکدست می‌ماند.",
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
    title: "چطور بسازیم؟",
    body: "از صفحه انتخاب تصویر، «استفاده از استایل ذخیره‌شده» را بزنید، سپس «ساخت استایل جدید».\n\nیک بوم خالی ۱۰۸۰×۱۰۸۰ باز می‌شود. لوگو، واترمارک یا متن را در جای دلخواه بگذارید. وقتی راضی شدید، استایل را ذخیره کنید.",
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
    title: "چطور اعمال کنیم؟",
    body: "عکسی که می‌خواهید ویرایش کنید را انتخاب کنید. «استفاده از استایل ذخیره‌شده» را بزنید.\n\nاستایل مورد نظر را از لیست انتخاب کنید — لوگو و واترمارک با اندازه نسبی روی عکس جدید قرار می‌گیرند.\n\nمی‌توانید بعدش هم ویرایش را ادامه دهید!",
    badge: "اعمال",
  },
  {
    illustrationBg: "from-primary/15 to-accent/10",
    illustrationContent: (
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-primary/15 border-2 border-primary/30 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-[160px]">تا ۵ استایل برای سبک‌های مختلف ذخیره کنید</p>
      </div>
    ),
    title: "آماده‌اید!",
    body: "استایل‌هایتان را می‌توانید از بخش «تنظیمات» مدیریت کنید — تغییر نام، حذف یا لیست کردن.\n\nنکته: مثلاً یک استایل با لوگوی پایین-راست و یکی با واترمارک مرکزی بسازید. هر نوع محتوا استایل مخصوص خودش را داشته باشد!",
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
  const [toolPage, setToolPage] = useState(0);
  const [stylePage, setStylePage] = useState(0);

  const selectedTool = TOOLS.find(t => t.id === selectedToolId) ?? null;
  const inToolDetail = view === "tools" && selectedToolId !== null;

  const handleBack = () => {
    if (view === "styles") { setView("home"); setStylePage(0); return; }
    if (inToolDetail) { setSelectedToolId(null); setToolPage(0); return; }
    setView("home");
  };

  return (
    <div className="min-h-dvh w-full max-w-[520px] mx-auto flex flex-col bg-background overflow-hidden select-none" dir="rtl">
      {/* ── Header ── */}
      <header className="h-13 bg-card border-b border-border flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          {inToolDetail ? (
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
            <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 min-h-0 overflow-y-auto">
              <AnimatePresence mode="wait">
                {!inToolDetail ? (
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

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setView("styles"); setStylePage(0); }}
                      className="w-full rounded-2xl border-2 border-border bg-card hover:border-primary/40 hover:bg-primary/4 transition-all text-right p-4 flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
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
                  <motion.div
                    key={`tool-${selectedToolId}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-sm space-y-4"
                  >
                    {selectedTool && <ToolDetail tool={selectedTool} page={toolPage} setPage={setToolPage} />}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
                          onClick={() => { setSelectedToolId(tool.id); setToolPage(0); }}
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

// ─── Tool detail card — multi-page with safety clamp ────────────────────────
function ToolDetail({ tool, page, setPage }: { tool: ToolDef; page: number; setPage: (p: number) => void }) {
  const Icon = tool.Icon;
  const totalPages = tool.pages.length;
  // Safety clamp: prevent crash when page is out of range
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const p = tool.pages[safePage];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
          <Icon className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{tool.label}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{tool.what}</p>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5">
        {tool.pages.map((_, i) => (
          <div key={i} className={`rounded-full transition-all duration-300 ${i === safePage ? 'w-5 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-border'}`} />
        ))}
      </div>

      {/* Page content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={safePage}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
        >
          <div className="mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              {p.badge}
            </span>
          </div>

          <div className={`w-full rounded-3xl bg-gradient-to-br ${p.illustrationBg} border border-border flex items-center justify-center py-7 mb-4`}
            dir="ltr">
            {p.illustrationContent}
          </div>

          <h3 className="text-lg font-bold text-foreground mb-2">{p.title}</h3>

          {p.body.split('\n\n').map((para, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-2">{para}</p>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Page navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage(Math.max(0, safePage - 1))}
          disabled={safePage === 0}
          className="w-10 h-10 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {safePage < totalPages - 1 && (
          <button
            onClick={() => setPage(safePage + 1)}
            className="flex-1 h-10 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm active:opacity-90 transition-opacity"
          >
            بعدی
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
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

      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className="flex-1 flex flex-col px-5 py-4"
        >
          <div className="mb-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              {p.badge}
            </span>
          </div>

          <div className={`w-full rounded-3xl bg-gradient-to-br ${p.illustrationBg} border border-border flex items-center justify-center py-8 mb-5`}>
            {p.illustrationContent}
          </div>

          <h2 className="text-xl font-bold text-foreground mb-3">{p.title}</h2>

          <div className="flex-1">
            {p.body.split("\n\n").map((para, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-3">{para}</p>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

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
