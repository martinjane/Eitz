import { ArrowRight } from "lucide-react";
import { EitashotLogo } from "@/components/EitashotLogo";
import { useLocation } from "wouter";

/**
 * Fair, plain-language Terms of Service for Eitashot (Eitashot.ir).
 * Kept intentionally simple — not a legal wall of text.
 */
export default function TermsOfService() {
  const [, setLocation] = useLocation();

  const sections: Array<{ title: string; items: string[] }> = [
    {
      title: "۱. پذیرش قوانین",
      items: [
        "با استفاده از ایتاشات، شما این قوانین را می‌پذیرید. اگر با هیچ‌بخشی موافق نیستید، از سرویس استفاده نکنید.",
      ],
    },
    {
      title: "۲. شرح سرویس",
      items: [
        "ایتاشات (Eitashot.ir) سرویسی برای ویرایش سریع تصویر و آماده‌سازی محتوا برای کانال‌های ایتا است.",
        "دسترسی به ایتاشات از طریق اپلیکیشن ایتا فراهم می‌شود و حساب کاربری شما به حساب ایتای شما متصل است.",
      ],
    },
    {
      title: "۳. حساب کاربری",
      items: [
        "هر شخص باید با حساب ایتای خودش وارد شود و مسئولیت حفظ امنیت حساب ایتای خود بر عهده اوست.",
        "استفاده از حساب دیگران، ساخت حساب‌های جعلی یا سوءاستفاده از سرویس مجاز نیست.",
      ],
    },
    {
      title: "۴. محتوای کاربران",
      items: [
        "مسئولیت کامل محتوایی که ویرایش یا آماده می‌کنید — از جمله رعایت قوانین جمهوری اسلامی ایران و حقوق دیگران — با شماست.",
        "محتوای غیرقانونی، توهین‌آمیز، مغایر با عرف یا نقض حقوق مالکیت معنوی دیگران مجاز نیست.",
        "ایتاشات حق دارد در صورت مشاهده سوءاستفاده، دسترسی کاربر خاطی را محدود یا قطع کند.",
      ],
    },
    {
      title: "۵. تبلیغات و پرداخت",
      items: [
        "ثبت تبلیغ کانال در ایتاشات مشمول شرایط ویژه تبلیغات است که هنگام ثبت آگهی نمایش داده می‌شود و باید آن را بپذیرید.",
        "آگهی‌ها پیش از انتشار بررسی می‌شوند و تأیید آگهی تضمین نمی‌شود؛ آگهی‌های تأییدنشده منتشر نخواهند شد.",
        "پرداخت‌ها از طریق درگاه پرداخت انجام می‌شود و پس از انتشار آگهی قابل بازگشت نیست، مگر در صورت قصور ایتاشات.",
      ],
    },
    {
      title: "۶. محدودیت سرویس",
      items: [
        "ایتاشات تلاش می‌کند همیشه در دسترس باشد، اما دسترسی بدون وقفه یا بدون خطا تضمین نمی‌شود.",
        "به‌روزرسانی‌ها، تغییرات یا توقف موقت یا دائمی سرویس با اطلاع کاربران توسط ایتاشات انجام می‌شود.",
      ],
    },
    {"title": "۷. تغییر قوانین", "items": [
      "ایتاشات می‌تواند این قوانین را به‌روزرسانی کند. ادامه استفاده از سرویس پس از تغییر قوانین به معنای پذیرش نسخه جدید است.",
    ]},
  ];

  return (
    <div className="min-h-dvh w-full max-w-[520px] mx-auto flex flex-col bg-background" dir="rtl">
      <header className="h-13 bg-card border-b border-border flex items-center justify-between px-3 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <EitashotLogo size={24} />
          <span className="font-bold text-sm text-foreground">قوانین و مقررات</span>
        </div>
        <button
          onClick={() => setLocation("/")}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 pb-16">
        <p className="text-xs text-muted-foreground leading-6">
          آخرین به‌روزرسانی: {new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(new Date())}
        </p>

        {sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="font-bold text-sm text-foreground">{s.title}</h2>
            <ul className="space-y-1.5">
              {s.items.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground leading-6 flex gap-2">
                  <span className="text-primary/60 mt-1.5 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="text-xs text-muted-foreground leading-6 pt-2 border-t border-border">
          اگر سوالی درباره این قوانین دارید، از بخش «ارسال بازخورد» در صفحه اصلی با ما در میان بگذارید.
        </p>
      </div>
    </div>
  );
}
