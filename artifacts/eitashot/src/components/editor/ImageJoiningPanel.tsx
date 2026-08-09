import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ImagePlus, Minus, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEditor } from "@/contexts/EditorContext";
import { toast } from "@/hooks/use-toast";

type Region = {
  id: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  src: string | null;
  parts?: Region[];
};

type Direction = "top" | "bottom" | "left" | "right";

const MAX_IMAGE_PIXELS = 24_000_000;

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

function initialRegions(src: string): Region[] {
  return [
    { id: "original", row: 0, col: 0, rowSpan: 1, colSpan: 1, src },
    { id: "empty-right", row: 0, col: 1, rowSpan: 1, colSpan: 1, src: null },
    { id: "empty-bottom", row: 1, col: 0, rowSpan: 1, colSpan: 1, src: null },
    { id: "empty-corner", row: 1, col: 1, rowSpan: 1, colSpan: 1, src: null },
  ];
}

function regionContainsOriginal(region: Region) {
  return region.parts?.some(regionContainsOriginal) || region.id === "original";
}

function cellsCovered(regions: Region[], row: number, col: number) {
  return regions.find(r => row >= r.row && row < r.row + r.rowSpan && col >= r.col && col < r.col + r.colSpan);
}

function resizeDataUrl(src: string, scale: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

async function compose(
  regions: Region[],
  rows: number,
  cols: number,
  cellWidth: number,
  cellHeight: number,
  separators: boolean,
  separatorColor: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, cellWidth * cols);
  canvas.height = Math.max(1, cellHeight * rows);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const region of regions) {
    if (!region.src) continue;
    const img = await loadImage(region.src);
    if (!img.width || !img.height) continue;
    const x = region.col * cellWidth;
    const y = region.row * cellHeight;
    const w = region.colSpan * cellWidth;
    const h = region.rowSpan * cellHeight;
    const scale = Math.max(w / img.width, h / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
    ctx.restore();
  }

  if (separators) {
    ctx.strokeStyle = separatorColor;
    ctx.lineWidth = Math.max(2, Math.round(Math.min(cellWidth, cellHeight) * 0.012));
    for (let row = 1; row < rows; row++) {
      const y = row * cellHeight;
      for (let col = 0; col < cols; col++) {
        const above = cellsCovered(regions, row - 1, col);
        const below = cellsCovered(regions, row, col);
        if (above === below) continue;
        ctx.beginPath();
        ctx.moveTo(col * cellWidth, y);
        ctx.lineTo((col + 1) * cellWidth, y);
        ctx.stroke();
      }
    }
    for (let col = 1; col < cols; col++) {
      const x = col * cellWidth;
      for (let row = 0; row < rows; row++) {
        const left = cellsCovered(regions, row, col - 1);
        const right = cellsCovered(regions, row, col);
        if (left === right) continue;
        ctx.beginPath();
        ctx.moveTo(x, row * cellHeight);
        ctx.lineTo(x, (row + 1) * cellHeight);
        ctx.stroke();
      }
    }
  }

  return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), width: canvas.width, height: canvas.height };
}

function canMerge(a: Region, b: Region) {
  if (a.src && b.src) return false;
  const horizontal = a.row === b.row && a.rowSpan === b.rowSpan &&
    (a.col + a.colSpan === b.col || b.col + b.colSpan === a.col);
  const vertical = a.col === b.col && a.colSpan === b.colSpan &&
    (a.row + a.rowSpan === b.row || b.row + b.rowSpan === a.row);
  return horizontal || vertical;
}

export default function ImageJoiningPanel() {
  const { state, setTool, setCompositionPreview, applyComposition } = useEditor();
  const cellWidth = Math.max(1, state.imageWidth);
  const cellHeight = Math.max(1, state.imageHeight);
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [regions, setRegions] = useState<Region[]>(() => initialRegions(state.sourceImage!));
  const [selectedId, setSelectedId] = useState("original");
  const [separators, setSeparators] = useState(true);
  const [separatorColor, setSeparatorColor] = useState("#e5e7eb");
  const [managerZoom, setManagerZoom] = useState(1);
  const [managerPan, setManagerPan] = useState({ x: 0, y: 0 });
  const [performanceReduced, setPerformanceReduced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeFillId = useRef<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const selected = regions.find(region => region.id === selectedId) ?? regions[0];
  const originalRegion = regions.find(regionContainsOriginal) ?? regions[0];

  const [preview, setPreview] = useState<{ dataUrl: string; width: number; height: number } | null>(null);

  useEffect(() => {
    let alive = true;
    compose(regions, rows, cols, cellWidth, cellHeight, separators, separatorColor)
      .then(result => { if (alive) setPreview(result); });
    return () => { alive = false; };
  }, [regions, rows, cols, cellWidth, cellHeight, separators, separatorColor]);

  useEffect(() => {
    if (!preview) return;
    setCompositionPreview({
      ...preview,
      transform: {
        offsetX: originalRegion.col * cellWidth,
        offsetY: originalRegion.row * cellHeight,
        scaleX: originalRegion.colSpan,
        scaleY: originalRegion.rowSpan,
      },
    });
  }, [preview, originalRegion, cellWidth, cellHeight, setCompositionPreview]);

  const close = useCallback(() => {
    setCompositionPreview(null);
    setTool("");
  }, [setCompositionPreview, setTool]);

  const fillSelected = () => {
    if (!selected || selected.src || regionContainsOriginal(selected)) return;
    activeFillId.current = selected.id;
    fileInputRef.current?.click();
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const id = activeFillId.current;
    if (!file || !id || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const src = reader.result as string;
      const img = await loadImage(src);
      const currentPixels = regions.reduce((sum, region) => {
        if (!region.src) return sum;
        return sum + (region.parts?.length || 1) * cellWidth * cellHeight;
      }, 0);
      const shouldReduce = performanceReduced || currentPixels + img.width * img.height > MAX_IMAGE_PIXELS;
      const optimized = shouldReduce ? await resizeDataUrl(src, 0.5) : src;
      if (shouldReduce && !performanceReduced) {
        setPerformanceReduced(true);
        toast({ title: "بهینه‌سازی تصویر", description: "برای روان ماندن ویرایشگر، تصاویر بزرگ با اندازه‌ی کمتر ذخیره شدند." });
      }
      setRegions(prev => prev.map(region => region.id === id ? { ...region, src: optimized } : region));
    };
    reader.readAsDataURL(file);
  };

  const addLine = (direction: Direction) => {
    setRegions(prev => {
      let next = prev.map(region => ({ ...region }));
      if (direction === "bottom") {
        next = [...next, ...Array.from({ length: cols }, (_, col) => ({ id: makeId(), row: rows, col, rowSpan: 1, colSpan: 1, src: null }))];
        setRows(value => value + 1);
      } else if (direction === "top") {
        next = [...next.map(region => ({ ...region, row: region.row + 1 })), ...Array.from({ length: cols }, (_, col) => ({ id: makeId(), row: 0, col, rowSpan: 1, colSpan: 1, src: null }))];
        setRows(value => value + 1);
      } else if (direction === "right") {
        next = [...next, ...Array.from({ length: rows }, (_, row) => ({ id: makeId(), row, col: cols, rowSpan: 1, colSpan: 1, src: null }))];
        setCols(value => value + 1);
      } else {
        next = [...next.map(region => ({ ...region, col: region.col + 1 })), ...Array.from({ length: rows }, (_, row) => ({ id: makeId(), row, col: 0, rowSpan: 1, colSpan: 1, src: null }))];
        setCols(value => value + 1);
      }
      return next;
    });
  };

  const mergeSelected = (direction: Direction) => {
    if (!selected) return;
    const neighbor = regions.find(region => {
      if (direction === "right") return region.row === selected.row && region.rowSpan === selected.rowSpan && region.col === selected.col + selected.colSpan;
      if (direction === "left") return region.row === selected.row && region.rowSpan === selected.rowSpan && region.col + region.colSpan === selected.col;
      if (direction === "bottom") return region.col === selected.col && region.colSpan === selected.colSpan && region.row === selected.row + selected.rowSpan;
      return region.col === selected.col && region.colSpan === selected.colSpan && region.row + region.rowSpan === selected.row;
    });
    if (!neighbor || !canMerge(selected, neighbor)) {
      toast({ title: "ادغام ممکن نیست", description: "دو بلوک پر از تصویر را نمی‌توان با هم ادغام کرد." });
      return;
    }
    const left = Math.min(selected.col, neighbor.col);
    const top = Math.min(selected.row, neighbor.row);
    const merged: Region = {
      id: makeId(),
      row: top,
      col: left,
      rowSpan: Math.max(selected.row + selected.rowSpan, neighbor.row + neighbor.rowSpan) - top,
      colSpan: Math.max(selected.col + selected.colSpan, neighbor.col + neighbor.colSpan) - left,
      src: selected.src || neighbor.src,
      parts: [...(selected.parts ?? [selected]), ...(neighbor.parts ?? [neighbor])],
    };
    setRegions(prev => [...prev.filter(region => region.id !== selected.id && region.id !== neighbor.id), merged]);
    setSelectedId(merged.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    if (selected.parts && selected.parts.length > 1) {
      setRegions(prev => [...prev.filter(region => region.id !== selected.id), ...selected.parts!]);
      return;
    }
    if (regionContainsOriginal(selected)) {
      toast({ title: "بلوک اصلی", description: "بلوک تصویر اصلی حذف نمی‌شود." });
      return;
    }
    if (selected.src) {
      setRegions(prev => prev.map(region => region.id === selected.id ? { ...region, src: null } : region));
      return;
    }
    const rowIsEmpty = Array.from({ length: cols }, (_, col) => cellsCovered(regions, selected.row, col)).every(region => region && !region.src);
    const colIsEmpty = Array.from({ length: rows }, (_, row) => cellsCovered(regions, row, selected.col)).every(region => region && !region.src);
    if (rows > 1 && rowIsEmpty) {
      setRegions(prev => prev.filter(region => region.row !== selected.row).map(region => ({ ...region, row: region.row > selected.row ? region.row - 1 : region.row })));
      setRows(value => value - 1);
      setSelectedId("original");
    } else if (cols > 1 && colIsEmpty) {
      setRegions(prev => prev.filter(region => region.col !== selected.col).map(region => ({ ...region, col: region.col > selected.col ? region.col - 1 : region.col })));
      setCols(value => value - 1);
      setSelectedId("original");
    } else {
      toast({ title: "ساختار حفظ شد", description: "برای جلوگیری از ناقص شدن چیدمان، این بلوک حذف نشد." });
    }
  };

  const apply = async () => {
    if (!preview) return;
    const result = preview;
    const sx = originalRegion.colSpan;
    const sy = originalRegion.rowSpan;
    applyComposition(result.dataUrl, result.width, result.height, {
      offsetX: originalRegion.col * cellWidth,
      offsetY: originalRegion.row * cellHeight,
      scaleX: sx,
      scaleY: sy,
    });
  };

  const managerPointerDown = (event: React.PointerEvent) => {
    dragRef.current = { x: event.clientX, y: event.clientY, panX: managerPan.x, panY: managerPan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const managerPointerMove = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    setManagerPan({
      x: dragRef.current.panX + event.clientX - dragRef.current.x,
      y: dragRef.current.panY + event.clientY - dragRef.current.y,
    });
  };
  const managerPointerUp = () => { dragRef.current = null; };

  if (!state.sourceImage || !selected) return null;

  return (
    <div className="space-y-2" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-sm text-foreground">چسباندن تصاویر</h3>
          <p className="text-[10px] text-muted-foreground">ساختار را بچینید، سپس خانه‌ها را پر کنید</p>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-7 h-7 rounded-lg border border-border hover:bg-muted" onClick={() => setManagerZoom(z => Math.max(0.5, z - 0.15))} title="کوچک‌نمایی"><Minus className="w-3.5 h-3.5 mx-auto" /></button>
          <span className="text-[10px] font-mono w-9 text-center">{Math.round(managerZoom * 100)}%</span>
          <button className="w-7 h-7 rounded-lg border border-border hover:bg-muted" onClick={() => setManagerZoom(z => Math.min(2.5, z + 0.15))} title="بزرگ‌نمایی"><Plus className="w-3.5 h-3.5 mx-auto" /></button>
          <button className="w-7 h-7 rounded-lg border border-border hover:bg-muted" onClick={() => { setManagerZoom(1); setManagerPan({ x: 0, y: 0 }); }} title="بازنشانی"><RotateCcw className="w-3.5 h-3.5 mx-auto" /></button>
          <button className="w-7 h-7 rounded-lg hover:bg-muted text-muted-foreground" onClick={close}><X className="w-4 h-4 mx-auto" /></button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFile} />
      <div
        className="relative h-[190px] rounded-2xl border border-border bg-muted/50 overflow-hidden cursor-grab active:cursor-grabbing"
        onPointerDown={managerPointerDown}
        onPointerMove={managerPointerMove}
        onPointerUp={managerPointerUp}
        onPointerCancel={managerPointerUp}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative" style={{ transform: `translate(${managerPan.x}px, ${managerPan.y}px) scale(${managerZoom})`, transformOrigin: "center" }}>
            <div className="grid gap-1 bg-border p-1 shadow-sm" style={{ gridTemplateColumns: `repeat(${cols}, 54px)`, gridTemplateRows: `repeat(${rows}, 42px)` }}>
              {Array.from({ length: rows * cols }, (_, index) => {
                const row = Math.floor(index / cols);
                const col = index % cols;
                const region = cellsCovered(regions, row, col);
                if (!region) return <div key={`${row}-${col}`} className="bg-white" />;
                const isOriginCell = region.col === col && region.row === row;
                if (!isOriginCell) return null;
                return (
                  <button
                    key={region.id}
                    onClick={event => { event.stopPropagation(); setSelectedId(region.id); if (!region.src && !regionContainsOriginal(region)) { activeFillId.current = region.id; fileInputRef.current?.click(); } }}
                    className={`relative flex items-center justify-center rounded-md border-2 text-[9px] font-semibold transition-colors ${
                      selectedId === region.id ? "border-primary ring-2 ring-primary/25" : "border-white/80"
                    } ${region.src ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-400"}`}
                    style={{ gridColumn: `${region.col + 1} / span ${region.colSpan}`, gridRow: `${region.row + 1} / span ${region.rowSpan}`, minHeight: 42 }}
                  >
                    {regionContainsOriginal(region) ? "اصلی" : region.src ? "پر" : "خالی"}
                    {region.parts && region.parts.length > 1 && <span className="absolute top-1 left-1 text-[8px]">↔</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <span className="absolute bottom-2 right-2 bg-background/85 rounded-full px-2 py-1 text-[9px] text-muted-foreground">برای جابه‌جایی بکشید</span>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {([
          ["top", ChevronUp, "ردیف بالا"],
          ["bottom", ChevronDown, "ردیف پایین"],
          ["right", ChevronRight, "ستون راست"],
          ["left", ChevronLeft, "ستون چپ"],
        ] as [Direction, React.ElementType, string][]).map(([direction, Icon, label]) => (
          <button key={direction} onClick={() => addLine(direction)} className="h-7 rounded-lg border border-dashed border-primary/40 text-[9px] text-primary hover:bg-primary/5 flex items-center justify-center gap-1">
            <Icon className="w-3 h-3" /> + {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <button onClick={fillSelected} disabled={!!selected.src || regionContainsOriginal(selected)} className="flex-1 h-8 rounded-lg bg-primary text-white text-[10px] font-bold disabled:opacity-40 flex items-center justify-center gap-1">
          <ImagePlus className="w-3.5 h-3.5" /> پر کردن خانه
        </button>
        <button onClick={removeSelected} className="h-8 px-2 rounded-lg border border-border text-[10px] hover:bg-muted flex items-center gap-1">
          <Trash2 className="w-3.5 h-3.5 text-destructive" /> حذف
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-foreground">ادغام:</span>
        {([
          ["right", ChevronRight],
          ["left", ChevronLeft],
          ["top", ChevronUp],
          ["bottom", ChevronDown],
        ] as [Direction, React.ElementType][]).map(([direction, Icon]) => (
          <button key={direction} onClick={() => mergeSelected(direction)} className="w-7 h-7 rounded-lg border border-border hover:bg-muted" title="ادغام با همسایه"><Icon className="w-3 h-3 mx-auto" /></button>
        ))}
        <span className="text-[9px] text-muted-foreground mr-auto">{selected.src ? "پر" : "خالی"} · {selected.colSpan}×{selected.rowSpan}</span>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-2">
        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
          <input type="checkbox" checked={separators} onChange={event => setSeparators(event.target.checked)} />
          خطوط جداکننده
        </label>
        {separators && <input type="color" value={separatorColor} onChange={event => setSeparatorColor(event.target.value)} className="color-swatch w-7 h-7 rounded-lg border border-border" title="رنگ خطوط" />}
        {performanceReduced && <span className="text-[9px] text-amber-600 mr-auto">تصاویر بهینه شدند</span>}
      </div>

      <div className="flex gap-2">
        <button onClick={apply} className="flex-1 h-9 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1"><Check className="w-3.5 h-3.5" /> اعمال ترکیب</button>
        <button onClick={close} className="h-9 px-4 rounded-xl border border-border text-xs hover:bg-muted">لغو</button>
      </div>
    </div>
  );
}