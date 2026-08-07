import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useEditor } from "@/contexts/EditorContext";
import { useAuth } from "@/contexts/AuthContext";
import { EitashotLogo } from "@/components/EitashotLogo";
import { useTheme } from "@/hooks/useTheme";
import EditorCanvas from "@/components/editor/EditorCanvas";
import ToolBar from "@/components/editor/ToolBar";
import ToolPanel from "@/components/editor/ToolPanel";
import LayerToolbar from "@/components/editor/LayerToolbar";
import StudioLayerPanel from "@/components/editor/StudioLayerPanel";
import { Download, ArrowRight, Zap, Layers, Undo2, Redo2, Moon, Sun, Save, X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { serializeLayersToStyle, MAX_STYLE_OBJECTS } from "@/lib/savedStyle";
import { createSavedStyle } from "@/lib/savedStylesApi";
import { toast } from "@/hooks/use-toast";

export default function Editor() {
  const [, setLocation] = useLocation();
  const { state, setState, setMode, exportCanvas, undo, redo, canUndo, canRedo, exitStyleMode, clearStyleLimitWarning } = useEditor();
  const { getToken } = useAuth();
  const [toolbarPosition, setToolbarPosition] = useState<"bottom" | "left">("bottom");
  const { isDark, toggle: toggleTheme } = useTheme();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [styleName, setStyleName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.sourceImage) {
      setLocation("/");
    }
  }, [state.sourceImage, setLocation]);

  useEffect(() => {
    if (state.styleLimitWarning) {
      toast({ title: "محدودیت اشیاء", description: state.styleLimitWarning, variant: "destructive" });
      clearStyleLimitWarning();
    }
  }, [state.styleLimitWarning, clearStyleLimitWarning]);

  const handleBack = () => {
    if (state.styleMode) {
      if (!confirm("ساخت استایل لغو شود؟ تغییرات ذخیره نخواهد شد.")) return;
      exitStyleMode();
      setLocation("/");
      return;
    }
    if (state.layers.length > 0 || state.activeFilter !== "normal") {
      if (!confirm("تغییرات شما ذخیره نخواهد شد. ادامه می‌دهید؟")) return;
    }
    setState(s => ({ ...s, sourceImage: null }));
    setLocation("/");
  };

  const handleSaveStyle = async () => {
    if (!styleName.trim()) return;
    setSaving(true);
    const data = serializeLayersToStyle(state.layers, state.imageWidth, state.imageHeight);
    const result = await createSavedStyle(getToken(), styleName.trim(), data);
    setSaving(false);
    if (!result.ok) {
      toast({ title: "خطا در ذخیره استایل", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "استایل ذخیره شد", description: `«${styleName.trim()}» با موفقیت ذخیره شد.` });
    setShowSaveDialog(false);
    setStyleName("");
    exitStyleMode();
    setLocation("/");
  };

  if (!state.sourceImage) return null;

  return (
    <div className="flex flex-col h-dvh w-full max-w-[520px] mx-auto bg-background overflow-hidden select-none" dir="rtl">
      {/* Header */}
      <header className="h-13 bg-card border-b border-border flex items-center justify-between px-3 shrink-0 sticky top-0 z-30">
        {/* Left: logo + name */}
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <EitashotLogo size={24} />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="font-bold text-sm text-foreground leading-none truncate">ایتاشات</span>
            <span className="text-[10px] text-muted-foreground tracking-wide hidden sm:inline">Eitashot</span>
          </div>
          {state.mode === "studio" && !state.styleMode && (
            <span className="text-[10px] bg-accent/20 text-accent-foreground px-1.5 py-0.5 rounded font-medium shrink-0">
              استودیو
            </span>
          )}
          {state.styleMode && (
            <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
              ساخت استایل
            </span>
          )}
        </div>

        {/* Right: undo / redo / theme / download / back */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" dir="ltr">
          {/* Undo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="واگرد (Undo)"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          {/* Redo */}
          <button
            onClick={redo}
            disabled={!canRedo}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="انجام دوباره (Redo)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title={isDark ? "حالت روشن" : "حالت تاریک"}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Download or Save-style */}
          {state.styleMode ? (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => setShowSaveDialog(true)}
              className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-2 sm:px-3 py-2 rounded-xl"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ذخیره استایل</span>
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={exportCanvas}
              className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-2 sm:px-3 py-2 rounded-xl"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">دانلود</span>
            </motion.button>
          )}

          {/* Back */}
          <button
            onClick={handleBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Image info bar */}
      {state.imageWidth > 0 && (
        <div className="h-6 bg-muted/50 border-b border-border flex items-center px-4 gap-3 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {state.imageWidth} × {state.imageHeight} px
          </span>
          {state.activeFilter !== "normal" && (
            <span className="text-[10px] text-primary font-medium">فیلتر فعال</span>
          )}
          {state.styleMode ? (
            <span className={`text-[10px] font-medium ${state.layers.length >= MAX_STYLE_OBJECTS ? "text-destructive" : "text-muted-foreground"}`}>
              {state.layers.length}/{MAX_STYLE_OBJECTS} شیء
            </span>
          ) : state.layers.length > 0 && (
            <span className="text-[10px] text-muted-foreground">{state.layers.length} لایه</span>
          )}
          <span className="text-[10px] text-muted-foreground mr-auto">دو انگشت = زوم | یک انگشت = جابجایی</span>
        </div>
      )}

      {/* Canvas area — flex-row when toolbar is on the left */}
      <div className="flex-1 min-h-0 flex overflow-hidden" dir="ltr">
        {toolbarPosition === "left" && (
          <ToolBar position="left" onToggle={() => setToolbarPosition("bottom")} />
        )}
        <div className="flex-1 min-h-0 relative overflow-hidden canvas-bg">
          <EditorCanvas />
          <LayerToolbar />
        </div>
      </div>

      {/* Studio layer panel */}
      {state.mode === "studio" && state.layers.length > 0 && !state.tool && (
        <StudioLayerPanel />
      )}

      {/* Tool panel */}
      <ToolPanel />

      {/* Bottom toolbar (hidden when toolbar is on the left) */}
      {toolbarPosition === "bottom" && (
        <ToolBar position="bottom" onToggle={() => setToolbarPosition("left")} />
      )}

      {/* Mode switcher — hidden while creating a Saved Style (studio mode is forced) */}
      {!state.styleMode && (
        <div className="h-11 bg-card border-t border-border flex shrink-0">
          <button
            onClick={() => setMode("quick")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
              state.mode === "quick"
                ? "text-primary border-t-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            ویرایش سریع
          </button>
          <div className="w-px bg-border my-2" />
          <button
            onClick={() => setMode("studio")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
              state.mode === "studio"
                ? "text-accent border-t-2 border-accent bg-accent/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            استودیو سازنده
          </button>
        </div>
      )}

      {/* Save Style dialog */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            key="save-style-backdrop"
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !saving && setShowSaveDialog(false)}
          >
            <motion.div
              key="save-style-card"
              className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-xl p-6 space-y-4"
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">ذخیره استایل</h2>
                <button onClick={() => setShowSaveDialog(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {state.layers.length === 0 && (
                <div className="flex items-start gap-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs rounded-xl p-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>هنوز هیچ شیئی اضافه نکرده‌اید. برای ادامه حداقل یک شیء (متن، لوگو، واترمارک و ...) اضافه کنید.</span>
                </div>
              )}
              <input
                value={styleName}
                onChange={e => setStyleName(e.target.value)}
                placeholder="نام استایل را وارد کنید..."
                autoFocus
                className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                onKeyDown={e => e.key === "Enter" && handleSaveStyle()}
              />
              <button
                onClick={handleSaveStyle}
                disabled={!styleName.trim() || saving || state.layers.length === 0}
                className="w-full h-11 bg-primary text-white font-bold rounded-xl shadow-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? "در حال ذخیره..." : "ذخیره"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
