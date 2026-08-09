import React, { useRef, useState, useEffect, useCallback } from "react";
import { useEditor } from "@/contexts/EditorContext";
import { useAuth } from "@/contexts/AuthContext";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";
import FilterPreview from "./FilterPreview";
import { Check, X, RotateCcw, RotateCw, FlipHorizontal2, FlipVertical2, Download, Loader2, Trash2, Upload } from "lucide-react";
import { toJalaliFilename } from "@/lib/jalali";
import { listLogos, uploadLogo, deleteLogo, type LogoRecord } from "@/lib/logosApi";
import { toast } from "@/hooks/use-toast";
import ImageJoiningPanel from "./ImageJoiningPanel";

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="font-bold text-sm text-foreground">{title}</h3>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ToolPanel() {
  const { state, setTool, setState, updateAdjustment, resetAdjustments, addLayer, applyResize, applyRotate, applyFlip, applyBlur, applyFrame } = useEditor();
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoAddInputRef = useRef<HTMLInputElement>(null);   // session-only (no upload)
  const logoSaveInputRef = useRef<HTMLInputElement>(null);  // upload + add as layer
  const [resizeW, setResizeW] = useState("");
  const [resizeH, setResizeH] = useState("");
  const [lockAspect, setLockAspect] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [textSize, setTextSize] = useState(60);
  const [textColor, setTextColor] = useState("#ffffff");
  const [wmText, setWmText] = useState("");
  const [wmOpacity, setWmOpacity] = useState(50);
  const [wmSize, setWmSize] = useState(32);
  const [wmPos, setWmPos] = useState<"br"|"bl"|"tr"|"tl"|"c">("br");
  const [blurAmount, setBlurAmount] = useState(4);
  const [frameWidth, setFrameWidth] = useState(30);
  const [frameColor, setFrameColor] = useState("#ffffff");
  // Logo panel state
  const [savedLogos, setSavedLogos] = useState<LogoRecord[]>([]);
  const [logosLoading, setLogosLoading] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);

  const close = () => setTool("");

  useEffect(() => {
    if (state.tool === "تغییر اندازه" && state.imageWidth && !resizeW) {
      setResizeW(String(state.imageWidth));
      setResizeH(String(state.imageHeight));
    }
  }, [state.tool]);

  // When the text or watermark tool opens, auto-set a size that looks good
  // for the current image — roughly 6% of image width for text, 4% for watermark.
  // The user can always change it with the slider before adding.
  useEffect(() => {
    if (!state.imageWidth) return;
    if (state.tool === "متن") {
      setTextSize(Math.max(16, Math.min(120, Math.round(state.imageWidth * 0.06))));
    } else if (state.tool === "واترمارک") {
      setWmSize(Math.max(10, Math.min(60, Math.round(state.imageWidth * 0.04))));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tool]); // intentionally omits imageWidth — fires only on tool open

  // Fetch saved logos when logo tool opens
  useEffect(() => {
    if (state.tool !== "لوگو") return;
    setLogosLoading(true);
    listLogos(getToken()).then(result => {
      if (result.ok && result.logos) setSavedLogos(result.logos);
      setLogosLoading(false);
    });
  }, [state.tool]);

  const handleResizeW = (v: string) => {
    setResizeW(v);
    if (lockAspect && state.imageWidth && state.imageHeight)
      setResizeH(String(Math.round(Number(v) * state.imageHeight / state.imageWidth)));
  };
  const handleResizeH = (v: string) => {
    setResizeH(v);
    if (lockAspect && state.imageWidth && state.imageHeight)
      setResizeW(String(Math.round(Number(v) * state.imageWidth / state.imageHeight)));
  };

  const handleAddText = () => {
    if (!textInput.trim()) return;
    addLayer({ type: "text", text: textInput, x: state.imageWidth / 2, y: state.imageHeight / 2, width: textInput.length * textSize * 0.65, height: textSize * 1.4, rotation: 0, opacity: 1, fontSize: textSize, color: textColor });
    setTextInput(""); close();
  };

  const handleAddWatermark = () => {
    if (!wmText.trim()) return;
    const positions: Record<string, { x: number; y: number }> = {
      br: { x: state.imageWidth * 0.82, y: state.imageHeight * 0.93 },
      bl: { x: state.imageWidth * 0.18, y: state.imageHeight * 0.93 },
      tr: { x: state.imageWidth * 0.82, y: state.imageHeight * 0.07 },
      tl: { x: state.imageWidth * 0.18, y: state.imageHeight * 0.07 },
      c:  { x: state.imageWidth / 2, y: state.imageHeight / 2 },
    };
    const { x, y } = positions[wmPos];
    addLayer({ type: "text", text: wmText, x, y, width: wmText.length * wmSize * 0.65, height: wmSize * 1.4, rotation: wmPos === "c" ? -30 : 0, opacity: wmOpacity / 100, fontSize: wmSize, color: "#ffffff" });
    close();
  };

  const handleOverlayImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxW = state.imageWidth * 0.5;
        const w = Math.min(maxW, img.width);
        addLayer({ type: "image", src, x: state.imageWidth / 2, y: state.imageHeight / 2, width: w, height: w * (img.height / img.width), rotation: 0, opacity: 1 });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = ""; close();
  };

  /** Add a logo as a session-only layer (no API upload). */
  const handleAddLogoSession = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const w = Math.min(state.imageWidth * 0.28, img.width);
        addLayer({ type: "image", src, x: state.imageWidth * 0.85, y: state.imageHeight * 0.1, width: w, height: w * (img.height / img.width), rotation: 0, opacity: 0.88 });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = ""; close();
  };

  /** Upload logo to account (persisted, max 5) then add as layer with logo_id. */
  const handleSaveLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    setLogoSaving(true);
    const result = await uploadLogo(getToken(), file);
    setLogoSaving(false);
    if (!result.ok || !result.logo) {
      toast({ title: "خطا در ذخیره لوگو", description: result.error, variant: "destructive" });
      return;
    }
    const logo = result.logo;
    setSavedLogos(prev => [...prev, logo]);
    // Add the newly uploaded logo as a layer with its persistent logo_id
    const img = new Image();
    img.onload = () => {
      const w = Math.min(state.imageWidth * 0.28, img.width);
      addLayer({ type: "image", src: logo.data, logo_id: logo.id, x: state.imageWidth * 0.85, y: state.imageHeight * 0.1, width: w, height: w * (img.height / img.width), rotation: 0, opacity: 0.88 });
    };
    img.src = logo.data;
    toast({ title: "لوگو ذخیره شد" });
    close();
  };

  /** Add a previously saved logo as a layer (resolves logo_id). */
  const handleAddSavedLogo = (logo: LogoRecord) => {
    const img = new Image();
    img.onload = () => {
      const w = Math.min(state.imageWidth * 0.28, img.width);
      addLayer({ type: "image", src: logo.data, logo_id: logo.id, x: state.imageWidth * 0.85, y: state.imageHeight * 0.1, width: w, height: w * (img.height / img.width), rotation: 0, opacity: 0.88 });
    };
    img.src = logo.data;
    close();
  };

  const handleDeleteSavedLogo = useCallback(async (id: number) => {
    const result = await deleteLogo(getToken(), id);
    if (!result.ok) {
      toast({ title: "خطا در حذف لوگو", description: result.error, variant: "destructive" });
      return;
    }
    setSavedLogos(prev => prev.filter(l => l.id !== id));
  }, [getToken]);

  // Panel hidden for crop (handled by canvas overlay) or when no tool selected
  if (!state.tool || state.tool === "برش") return null;

  return (
    <AnimatePresence>
      <motion.div
        key={state.tool}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.13, ease: "easeOut" }}
         className={`shrink-0 bg-card border-t border-border z-20 ${state.tool === "چسباندن تصاویر" ? "max-h-[470px]" : ""}`}
        dir="rtl"
      >
        <div className={`px-3 pt-2.5 pb-2 overflow-y-auto ${state.tool === "چسباندن تصاویر" ? "max-h-[470px]" : "max-h-[162px]"}`}>
          {state.tool === "چسباندن تصاویر" && <ImageJoiningPanel />}

          {/* RESIZE */}
          {state.tool === "تغییر اندازه" && (
            <div className="space-y-2">
              <PanelHeader title={`تغییر اندازه — فعلی: ${state.imageWidth}×${state.imageHeight}`} onClose={close} />
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground mb-1 block">عرض (px)</label>
                  <Input value={resizeW} onChange={e => handleResizeW(e.target.value)} type="number" min="1" className="h-8 text-sm" />
                </div>
                <button onClick={() => setLockAspect(!lockAspect)} className={`mb-0.5 w-8 h-8 rounded-lg border flex items-center justify-center text-sm transition-colors ${lockAspect ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}>
                  {lockAspect ? "🔒" : "🔓"}
                </button>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground mb-1 block">ارتفاع (px)</label>
                  <Input value={resizeH} onChange={e => handleResizeH(e.target.value)} type="number" min="1" className="h-8 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                {([["50%", 0.5],["75%", 0.75],["2×", 2]] as [string,number][]).map(([lbl,f]) => (
                  <button key={lbl} onClick={() => { setResizeW(String(Math.round(state.imageWidth*f))); setResizeH(String(Math.round(state.imageHeight*f))); }} className="flex-1 text-[10px] py-1 px-1 rounded-lg border border-border hover:bg-muted transition-colors">{lbl}</button>
                ))}
                <Button className="flex-1 bg-primary text-white h-7 text-xs" onClick={() => { const w=parseInt(resizeW),h=parseInt(resizeH); if(w>0&&h>0){applyResize(w,h);setResizeW("");setResizeH("");} }}>
                  <Check className="w-3 h-3 ml-1" />اعمال
                </Button>
              </div>
            </div>
          )}

          {/* ROTATE */}
          {state.tool === "چرخش" && (
            <div className="space-y-2">
              <PanelHeader title="چرخش تصویر" onClose={close} />
              <div className="grid grid-cols-4 gap-1.5">
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={() => applyRotate(-90)}><RotateCcw className="w-3 h-3"/>۹۰−</Button>
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={() => applyRotate(90)}><RotateCw className="w-3 h-3"/>۹۰+</Button>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => applyRotate(180)}>۱۸۰°</Button>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setState(s => ({...s, rotation: 0}))}>ریست</Button>
              </div>
              <div className="flex items-center gap-2">
                <Slider min={-180} max={180} step={1} value={[state.rotation]} onValueChange={v => setState(s => ({...s, rotation: v[0]}))} className="flex-1"/>
                <span className="text-xs font-mono w-10 text-center">{state.rotation}°</span>
              </div>
              {state.rotation !== 0 && (
                <Button className="w-full bg-primary text-white h-8 text-xs" onClick={() => applyRotate(state.rotation)}>
                  <Check className="w-3 h-3 ml-1"/>اعمال چرخش {state.rotation}°
                </Button>
              )}
            </div>
          )}

          {/* FLIP */}
          {state.tool === "وارونه" && (
            <div className="space-y-2">
              <PanelHeader title="وارونه کردن" onClose={close} />
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-14 flex-col gap-1.5" onClick={() => applyFlip("h")}>
                  <FlipHorizontal2 className="w-5 h-5"/><span className="text-xs">افقی</span>
                </Button>
                <Button variant="outline" className="h-14 flex-col gap-1.5" onClick={() => applyFlip("v")}>
                  <FlipVertical2 className="w-5 h-5"/><span className="text-xs">عمودی</span>
                </Button>
              </div>
            </div>
          )}

          {/* TEXT */}
          {state.tool === "متن" && (
            <div className="space-y-2">
              <PanelHeader title="افزودن متن" onClose={close} />
              <Input value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="متن خود را وارد کنید..." className="h-8 text-sm" autoFocus onKeyDown={e => e.key === "Enter" && handleAddText()} />
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <Slider
                    min={Math.max(8, Math.round(state.imageWidth * 0.012))}
                    max={Math.min(400, Math.round(state.imageWidth * 0.6))}
                    value={[textSize]}
                    onValueChange={v => setTextSize(v[0])}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-center">{textSize}px</span>
                <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="color-swatch w-9 h-9 rounded-xl cursor-pointer border-2 border-border shrink-0"/>
              </div>
              <Button className="w-full bg-primary text-white h-8 text-xs" onClick={handleAddText}>افزودن متن</Button>
            </div>
          )}

          {/* DRAW */}
          {state.tool === "نقاشی" && (
            <div className="space-y-2">
              <PanelHeader title="نقاشی آزاد — روی تصویر بکشید" onClose={close} />
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <Slider min={2} max={40} value={[state.drawSize]} onValueChange={v => setState(s => ({...s, drawSize: v[0]}))} />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-center">{state.drawSize}px</span>
                <input type="color" value={state.drawColor} onChange={e => setState(s => ({...s, drawColor: e.target.value}))} className="color-swatch w-9 h-9 rounded-xl cursor-pointer border-2 border-border shrink-0"/>
              </div>
              <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={close}>
                <Check className="w-3 h-3 ml-1"/>تأیید نقاشی
              </Button>
            </div>
          )}

          {/* FILTERS */}
          {state.tool === "فیلتر" && (
            <div>
              <PanelHeader title="فیلترهای تصویر" onClose={close} />
              <FilterPreview />
            </div>
          )}

          {/* ADJUSTMENTS */}
          {state.tool === "تنظیمات" && (
            <div className="space-y-2">
              <PanelHeader title="تنظیمات رنگ" onClose={close} />
              {([
                { key: "brightness" as const, label: "روشنایی" },
                { key: "contrast" as const, label: "کنتراست" },
                { key: "saturation" as const, label: "اشباع رنگ" },
              ]).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="text-[10px] text-muted-foreground w-20 shrink-0">{label}</label>
                  <Slider min={0} max={200} value={[state.adjustments[key]]} onValueChange={v => updateAdjustment(key, v[0])} className="flex-1"/>
                  <span className="text-[10px] font-mono w-8 text-center">{state.adjustments[key]}</span>
                </div>
              ))}
              <button className="text-[10px] text-muted-foreground underline" onClick={resetAdjustments}>بازنشانی</button>
            </div>
          )}

          {/* LOGO */}
          {state.tool === "لوگو" && (
            <div className="space-y-2">
              <PanelHeader title="لوگو" onClose={close} />

              {/* Hidden file inputs */}
              <input type="file" accept="image/*" ref={logoAddInputRef} className="hidden" onChange={handleAddLogoSession}/>
              <input type="file" accept="image/*" ref={logoSaveInputRef} className="hidden" onChange={handleSaveLogoUpload}/>

              {/* Action buttons */}
              <div className="flex gap-2">
                {/* Add Logo (session-only) — disabled in style creation mode */}
                {!state.styleMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1"
                    onClick={() => logoAddInputRef.current?.click()}
                  >
                    + افزودن موقت
                  </Button>
                )}
                {/* Save Logo to account */}
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs gap-1 bg-accent text-accent-foreground"
                  onClick={() => logoSaveInputRef.current?.click()}
                  disabled={logoSaving}
                >
                  {logoSaving ? <Loader2 className="w-3 h-3 animate-spin"/> : <Upload className="w-3 h-3"/>}
                  ذخیره لوگو
                </Button>
              </div>

              {state.styleMode && (
                <p className="text-[10px] text-muted-foreground">در حالت ساخت استایل فقط لوگوهای ذخیره‌شده قابل استفاده‌اند.</p>
              )}

              {/* Saved logos list */}
              {logosLoading ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground"/>
                </div>
              ) : savedLogos.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-1">هنوز لوگویی ذخیره نشده</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {savedLogos.map(logo => (
                    <div key={logo.id} className="relative shrink-0 group">
                      <button
                        onClick={() => handleAddSavedLogo(logo)}
                        className="w-12 h-12 rounded-xl border-2 border-border hover:border-primary transition-colors overflow-hidden bg-muted"
                      >
                        <img src={logo.data} alt="logo" className="w-full h-full object-contain p-1"/>
                      </button>
                      <button
                        onClick={() => handleDeleteSavedLogo(logo.id)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5"/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground text-center">حداکثر ۵ لوگو | پس از افزودن با دو انگشت اندازه را تنظیم کنید</p>
            </div>
          )}

          {/* WATERMARK */}
          {state.tool === "واترمارک" && (
            <div className="space-y-2">
              <PanelHeader title="واترمارک ★" onClose={close} />
              <Input value={wmText} onChange={e => setWmText(e.target.value)} placeholder="@کانال شما یا نام برند" className="h-8 text-sm" autoFocus/>
              <div className="flex gap-2 items-center">
                <div className="flex-1 space-y-0.5">
                  <label className="text-[10px] text-muted-foreground">شفافیت {wmOpacity}%</label>
                  <Slider min={10} max={100} value={[wmOpacity]} onValueChange={v => setWmOpacity(v[0])}/>
                </div>
                <div className="flex-1 space-y-0.5">
                  <label className="text-[10px] text-muted-foreground">اندازه {wmSize}px</label>
                  <Slider
                    min={Math.max(8, Math.round(state.imageWidth * 0.008))}
                    max={Math.min(160, Math.round(state.imageWidth * 0.15))}
                    value={[wmSize]}
                    onValueChange={v => setWmSize(v[0])}
                  />
                </div>
              </div>
              <div className="flex gap-1">
                {(["tr","tl","br","bl","c"] as const).map(p => (
                  <button key={p} onClick={() => setWmPos(p)} className={`flex-1 text-[9px] py-1 rounded-lg border transition-colors ${wmPos===p?"bg-accent text-accent-foreground border-accent":"border-border text-muted-foreground hover:bg-muted"}`}>
                    {p==="tr"?"↗":p==="tl"?"↖":p==="br"?"↘":p==="bl"?"↙":"⊙"}
                  </button>
                ))}
                <Button className="bg-accent text-accent-foreground font-bold h-7 text-xs px-3" onClick={handleAddWatermark}>+</Button>
              </div>
            </div>
          )}

          {/* BLUR (Studio) */}
          {state.tool === "بلور" && (
            <div className="space-y-2">
              <PanelHeader title="محو / بلور ★" onClose={close} />
              <p className="text-xs text-muted-foreground">افکت محو گاوسی روی کل تصویر اعمال می‌شود.</p>
              <div className="flex items-center gap-2">
                <Slider min={1} max={20} step={0.5} value={[blurAmount]} onValueChange={v => setBlurAmount(v[0])} className="flex-1"/>
                <span className="text-xs font-mono w-12 text-center">{blurAmount}px</span>
              </div>
              <Button className="w-full bg-primary text-white h-8 text-xs" onClick={() => applyBlur(blurAmount)}>
                <Check className="w-3 h-3 ml-1"/>اعمال بلور
              </Button>
            </div>
          )}

          {/* FRAME (Studio) */}
          {state.tool === "کادر" && (
            <div className="space-y-2">
              <PanelHeader title="کادر / حاشیه ★" onClose={close} />
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-0.5">
                  <label className="text-[10px] text-muted-foreground">ضخامت ({frameWidth}px)</label>
                  <Slider min={5} max={200} value={[frameWidth]} onValueChange={v => setFrameWidth(v[0])}/>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <label className="text-[10px] text-muted-foreground">رنگ</label>
                  <input type="color" value={frameColor} onChange={e => setFrameColor(e.target.value)} className="color-swatch w-9 h-9 rounded-xl cursor-pointer border-2 border-border"/>
                </div>
              </div>
              <div className="flex gap-2">
                {(["#ffffff","#000000","#E05A0C","#FFD700","hsl(22,20%,92%)"] as const).map(c => (
                  <button key={c} onClick={() => setFrameColor(c)} className={`w-8 h-8 rounded-lg border-2 transition-all ${frameColor===c?"border-primary scale-110":"border-border/50"}`} style={{background:c}}/>
                ))}
              </div>
              <Button className="w-full bg-primary text-white h-8 text-xs" onClick={() => applyFrame(frameWidth, frameColor)}>
                <Check className="w-3 h-3 ml-1"/>اعمال کادر
              </Button>
            </div>
          )}

          {/* IMAGE OVERLAY */}
          {state.tool === "تصویر" && (
            <div className="space-y-2">
              <PanelHeader title="افزودن تصویر روی‌هم" onClose={close} />
              <p className="text-xs text-muted-foreground">تصویر روی تصویر اصلی قرار می‌گیرد. با دو انگشت اندازه‌اش را تغییر دهید.</p>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleOverlayImage}/>
              <Button className="w-full bg-primary text-white h-9 text-sm" onClick={() => fileInputRef.current?.click()}>انتخاب تصویر</Button>
            </div>
          )}

          {/* LAYER PANEL (Studio) */}
          {state.tool === "لایه‌ها" && (
            <div className="space-y-1.5">
              <PanelHeader title="مدیریت لایه‌ها ★" onClose={close} />
              {state.layers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">هنوز لایه‌ای اضافه نشده است</p>
              ) : (
                <div className="space-y-1">
                  {[...state.layers].reverse().map(layer => (
                    <LayerRow key={layer.id} layer={layer}/>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EXPORT */}
          {state.tool === "خروجی" && (
            <div className="space-y-2">
              <PanelHeader title="دانلود و خروجی" onClose={close} />
              <div className="bg-muted rounded-xl px-3 py-2 text-[10px] text-muted-foreground flex gap-4">
                <span>{state.imageWidth} × {state.imageHeight} px</span>
                <span>{state.layers.length} لایه</span>
                <span>{state.activeFilter !== "normal" ? state.activeFilter : "بدون فیلتر"}</span>
              </div>
              <Button className="w-full bg-primary text-white h-10 text-sm font-bold" onClick={() => {
                const c = document.getElementById("eitashot-canvas") as HTMLCanvasElement;
                if(!c) return;
                const a = document.createElement("a"); a.download=`${toJalaliFilename()}.jpg`; a.href=c.toDataURL("image/jpeg",0.93); a.click();
                close();
              }}>
                <Download className="w-4 h-4 ml-2"/>دانلود JPG
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function LayerRow({ layer }: { layer: { id: string; type: string; text?: string; shape?: string; opacity: number; logo_id?: number } }) {
  const { selectLayer, deleteLayer, reorderLayer, updateLayer, state } = useEditor();
  const isSelected = state.selectedLayerId === layer.id;
  const label = layer.type === "text"
    ? `T: ${layer.text?.slice(0,14)}`
    : layer.type === "image"
      ? (layer.logo_id ? `🏷 لوگو #${layer.logo_id}` : "📷 تصویر")
      : "شکل";
  return (
    <div onClick={() => selectLayer(layer.id)} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs ${isSelected?"bg-primary/10 border-primary/30":"border-border hover:bg-muted"}`}>
      <span className="flex-1 truncate">{label}</span>
      <input type="range" min="0" max="100" value={Math.round(layer.opacity*100)} onChange={e => updateLayer(layer.id,{opacity:Number(e.target.value)/100})} onClick={e => e.stopPropagation()} className="w-12 h-1 accent-orange-500"/>
      <button onClick={e=>{e.stopPropagation();reorderLayer(layer.id,"up");}} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground">↑</button>
      <button onClick={e=>{e.stopPropagation();reorderLayer(layer.id,"down");}} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground">↓</button>
      <button onClick={e=>{e.stopPropagation();deleteLayer(layer.id);}} className="w-5 h-5 flex items-center justify-center text-destructive">✕</button>
    </div>
  );
}
