import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useEditor } from "@/contexts/EditorContext";
import { useAuth } from "@/contexts/AuthContext";
import { EitashotLogo } from "@/components/EitashotLogo";
import { ArrowRight, Plus, Sparkles, Trash2, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { listSavedStyles, deleteSavedStyle, type SavedStyleRecord } from "@/lib/savedStylesApi";
import { listLogos } from "@/lib/logosApi";
import { applyStyleToLayers } from "@/lib/savedStyle";
import { toast } from "@/hooks/use-toast";

export default function SavedStyles() {
  const [, setLocation] = useLocation();
  const { state, setState, enterStyleMode } = useEditor();
  const { getToken } = useAuth();

  const [styles, setStyles] = useState<SavedStyleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [applying, setApplying] = useState<number | null>(null);

  // Check if we arrived here with an image loaded (normal flow from Home choice screen)
  const hasImage = Boolean(state.sourceImage);

  useEffect(() => {
    const token = getToken();
    setLoading(true);
    listSavedStyles(token).then(result => {
      if (result.ok && result.styles) {
        setStyles(result.styles);
        setError(null);
      } else {
        setError(result.error ?? "خطا در بارگذاری استایل‌ها");
      }
      setLoading(false);
    });
  }, []);

  const handleApplyStyle = async (style: SavedStyleRecord) => {
    if (!hasImage) {
      toast({ title: "ابتدا تصویری انتخاب کنید", variant: "destructive" });
      return;
    }
    setApplying(style.id);
    // Resolve logo_ids → data URLs
    const logosResult = await listLogos(getToken());
    const logoMap = new Map<number, string>();
    if (logosResult.ok && logosResult.logos) {
      logosResult.logos.forEach(l => logoMap.set(l.id, l.data));
    }
    const layers = applyStyleToLayers(
      style.data,
      state.imageWidth,
      state.imageHeight,
      logoMap,
    );
    setState(s => ({ ...s, layers, tool: "", mode: "studio" }));
    setApplying(null);
    setLocation("/editor");
  };

  const handleCreateNew = () => {
    enterStyleMode();
    setLocation("/editor");
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("این استایل حذف شود؟")) return;
    setDeleting(id);
    const result = await deleteSavedStyle(getToken(), id);
    setDeleting(null);
    if (!result.ok) {
      toast({ title: "خطا در حذف استایل", description: result.error, variant: "destructive" });
      return;
    }
    setStyles(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="min-h-dvh w-full max-w-[520px] mx-auto flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <header className="h-13 bg-card border-b border-border flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <EitashotLogo size={24} />
          <span className="font-bold text-sm text-foreground">استایل‌های ذخیره‌شده</span>
        </div>
        <button
          onClick={() => setLocation("/")}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      {/* Image context banner */}
      {!hasImage && (
        <div className="mx-4 mt-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          برای اعمال استایل، ابتدا از صفحه اصلی یک تصویر انتخاب کنید.
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Create new button — disabled at the 5-style cap */}
        {!loading && styles.length >= 5 ? (
          <div className="w-full h-14 bg-muted/60 border-2 border-dashed border-border text-muted-foreground text-sm rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed">
            <Plus className="w-4 h-4" />
            <span>ساخت استایل جدید</span>
            <span className="text-[10px] opacity-70">(سقف ۵ استایل)</span>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleCreateNew}
            disabled={loading}
            className="w-full h-14 bg-primary/10 border-2 border-dashed border-primary/40 text-primary font-bold text-sm rounded-2xl flex items-center justify-center gap-2 hover:bg-primary/15 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            ساخت استایل جدید
          </motion.button>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertCircle className="w-8 h-8 text-destructive/60" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && styles.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-bold text-foreground">هنوز استایلی ندارید</h2>
            <p className="text-sm text-muted-foreground max-w-[220px] leading-relaxed">
              استایل‌ها مجموعه‌ای از شیءهای تنظیم‌شده‌اند که می‌توانید روی هر تصویری اعمال کنید.
            </p>
          </div>
        )}

        {/* Style list */}
        <AnimatePresence>
          {styles.map(style => (
            <motion.div
              key={style.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className={`relative bg-card border border-border rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors ${!hasImage ? "opacity-60" : ""}`}
              onClick={() => handleApplyStyle(style)}
            >
              {/* Icon */}
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{style.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {style.data.objects?.length ?? 0} شیء
                  {" · "}
                  {new Date(style.createdAt).toLocaleDateString("fa-IR", { month: "short", day: "numeric" })}
                </p>
              </div>

              {/* Apply indicator */}
              {applying === style.id ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              ) : (
                <span className="text-xs text-primary font-medium shrink-0">اعمال ←</span>
              )}

              {/* Delete button */}
              <button
                onClick={e => handleDelete(style.id, e)}
                disabled={deleting === style.id}
                className="absolute top-2 left-2 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
              >
                {deleting === style.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom info */}
      <div className="px-4 pb-6 pt-2 text-center">
        <p className="text-[10px] text-muted-foreground">
          حداکثر ۵ استایل | هر استایل شامل ≤ ۱۰ شیء
        </p>
      </div>
    </div>
  );
}
