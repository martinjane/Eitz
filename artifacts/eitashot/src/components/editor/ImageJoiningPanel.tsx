import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ImagePlus, Minus, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEditor } from "@/contexts/EditorContext";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { getDeviceResolution } from "@/lib/deviceCapability";
import { getAutoReduceEnabled } from "@/lib/autoReduceStorage";

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

/**
 * Run a quick canvas benchmark to measure device rendering performance.
 * Returns elapsed ms for 3 rounds of getImageData+putImageData on a 256x256 canvas.
 */
function benchmarkCanvas(): number {
  try {
    const bench = document.createElement("canvas");
    bench.width = 256;
    bench.height = 256;
    const ctx = bench.getContext("2d");
    if (!ctx) return 15;
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, 256, 256);
    const t0 = performance.now();
    for (let i = 0; i < 3; i++) {
      ctx.getImageData(0, 0, 256, 256);
      ctx.putImageData(ctx.getImageData(0, 0, 256, 256), 0, 0);
    }
    return performance.now() - t0;
  } catch {
    return 15;
  }
}

/** Flip x for RTL: column 0 → rightmost position */
function rtlX(col: number, colSpan: number, totalCols: number, cellW: number): number {
  return (totalCols - col - colSpan) * cellW;
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
    const x = rtlX(region.col, region.colSpan, cols, cellWidth);
    const y = region.row * cellHeight;
    const w = region.colSpan * cellWidth;
    const h = region.rowSpan * cellHeight;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }

  if (separators) {
    ctx.strokeStyle = separatorColor;
    ctx.lineWidth = Math.max(2, Math.round(Math.min(cellWidth, cellHeight) * 0.012));
    // Horizontal lines between rows
    for (let row = 1; row < rows; row++) {
      const y = row * cellHeight;
      for (let col = 0; col < cols; col++) {
        const above = cellsCovered(regions, row - 1, col);
        const below = cellsCovered(regions, row, col);
        if (above === below) continue;
        const x = rtlX(col, 1, cols, cellWidth);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + cellWidth, y);
        ctx.stroke();
      }
    }
    // Vertical lines between columns
    for (let col = 1; col < cols; col++) {
      const x = rtlX(col, 0, cols, cellWidth);
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
  // Adjacent by edge
  const horizontal = a.row === b.row &&
    (a.col + a.colSpan === b.col || b.col + b.colSpan === a.col);
  const vertical = a.col === b.col &&
    (a.row + a.rowSpan === b.row || b.row + b.rowSpan === a.row);
  return horizontal || vertical;
}

/** Find any region adjacent to `selected` in the given visual direction */
function findNeighbor(regions: Region[], selected: Region, dir: Direction): Region | undefined {
  return regions.find(r => {
    if (r.id === selected.id) return false;
    // CSS Grid renders columns left-to-right regardless of dir attribute
    if (dir === "right") return r.row === selected.row && r.col === selected.col + selected.colSpan;
    if (dir === "left") return r.row === selected.row && r.col + r.colSpan === selected.col;
    if (dir === "bottom") return r.col === selected.col && r.row === selected.row + selected.rowSpan;
    return r.col === selected.col && r.row + r.rowSpan === selected.row;
  });
}

export default function ImageJoiningPanel() {
  const { state, setTool, setCompositionPreview, applyComposition, setImageJoiningState } = useEditor();
  const cellWidth = Math.max(1, state.imageWidth);
  const cellHeight = Math.max(1, state.imageHeight);

  // Restore saved layout if it matches the current source image
  const savedState = state.imageJoiningState;
  const canRestore = savedState && savedState.sourceImageRef === state.sourceImage;

  const [rows, setRows] = useState(canRestore ? savedState!.rows : 2);
  const [cols, setCols] = useState(canRestore ? savedState!.cols : 2);
  const [regions, setRegions] = useState<Region[]>(() => {
    if (canRestore) return savedState!.regions as Region[];
    return initialRegions(state.sourceImage!);
  });
  const [selectedId, setSelectedId] = useState(canRestore ? (savedState!.regions[0]?.id ?? "original") : "original");
  const [separators, setSeparators] = useState(true);
  const [separatorColor, setSeparatorColor] = useState("#e5e7eb");
  const [managerZoom, setManagerZoom] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeFillId = useRef<string | null>(null);

  // Pan refs (single-finger drag)
  const panRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; hasMoved: boolean } | null>(null);
  const panOuterRef = useRef<HTMLDivElement>(null);

  // Pinch-to-zoom refs
  const pinchRef = useRef<{ initialDist: number; initialZoom: number } | null>(null);

  // Performance baseline: tracks the total pixel count at which the device was last smooth.
  // We only reduce when the composition EXCEEDS this baseline (i.e., got bigger and laggy).
  const deviceLimit = getDeviceResolution();
  const perfBaselineRef = useRef<number>(deviceLimit * deviceLimit * 4);

  // Original sources before auto-reduction (for revert)
  const originalSourcesRef = useRef<Map<string, string>>(new Map());
  const isReducingRef = useRef(false);

  const selected = regions.find(region => region.id === selectedId) ?? regions[0];
  const originalRegion = regions.find(regionContainsOriginal) ?? regions[0];

  const [preview, setPreview] = useState<{ dataUrl: string; width: number; height: number } | null>(null);

  useEffect(() => {
    let alive = true;
    compose(regions, rows, cols, cellWidth, cellHeight, separators, separatorColor)
      .then(result => { if (alive) setPreview(result); });
    return () => { alive = false; };
  }, [regions, rows, cols, cellWidth, cellHeight, separators, separatorColor]);

  // Performance check after each compose: only reduce if device is actually struggling
  useEffect(() => {
    if (!preview || !getAutoReduceEnabled() || isReducingRef.current) return;
    let cancelled = false;
    const totalPixels = preview.width * preview.height;

    // Quick pixel-count check first (cheap)
    if (totalPixels <= perfBaselineRef.current) return;

    // Pixel count exceeds baseline — run a benchmark to confirm the device is lagging
    const elapsed = benchmarkCanvas();
    const isLagging = elapsed > 30; // ms threshold for 3 rounds of 256x256

    if (!isLagging) {
      // Device handled it fine at this size — raise the baseline so we know this size is OK
      perfBaselineRef.current = totalPixels;
      return;
    }

    // Device IS struggling — store originals (first reduction only) and reduce gently
    isReducingRef.current = true;
    (async () => {
      // Save original sources before any reduction (only once)
      if (originalSourcesRef.current.size === 0) {
        for (const r of regions) {
          if (r.src) originalSourcesRef.current.set(r.id, r.src);
        }
      }

      const newRegions: Region[] = [];
      for (const r of regions) {
        if (r.src) {
          newRegions.push({ ...r, src: await resizeDataUrl(r.src, 0.85) });
        } else {
          newRegions.push({ ...r });
        }
      }
      perfBaselineRef.current = totalPixels;
      if (!cancelled) {
        setRegions(newRegions);
        toast({
          title: "کیفیت تصویر کاهش یافت",
          description: "برای جلوگیری از کندی، اندازه تصاویر بهینه شد. اگر تفاوت کیفیت محسوسی ندارید، بهتر است برگردانده نشود.",
          duration: 5000,
          action: (
            <ToastAction altText="بازگردان" onClick={() => {
              // Revert: restore original sources
              setRegions(prev => prev.map(r => {
                const orig = originalSourcesRef.current.get(r.id);
                return orig ? { ...r, src: orig } : r;
              }));
              // Reset baseline so device can re-evaluate
              perfBaselineRef.current = deviceLimit * deviceLimit * 4;
              originalSourcesRef.current.clear();
            }}>
              بازگردان
            </ToastAction>
          ),
        });
      }
      isReducingRef.current = false;
    })();
    return () => { cancelled = true; isReducingRef.current = false; };
  }, [preview]);

  useEffect(() => {
    if (!preview) return;
    setCompositionPreview({
      ...preview,
      transform: {
        offsetX: rtlX(originalRegion.col, originalRegion.colSpan, cols, cellWidth),
        offsetY: originalRegion.row * cellHeight,
        scaleX: originalRegion.colSpan,
        scaleY: originalRegion.rowSpan,
      },
    });
  }, [preview, originalRegion, cellWidth, cellHeight, cols, setCompositionPreview]);

  // Close: do NOT save layout state — only apply saves
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
      setRegions(prev => prev.map(region => region.id === id ? { ...region, src } : region));
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
      } else if (direction === "left") {
        // Visual left in RTL = higher col index → add at end
        next = [...next, ...Array.from({ length: rows }, (_, row) => ({ id: makeId(), row, col: cols, rowSpan: 1, colSpan: 1, src: null }))];
        setCols(value => value + 1);
      } else {
        // Visual right in RTL = col 0 side → shift everything +1, add at col 0
        next = [...next.map(region => ({ ...region, col: region.col + 1 })), ...Array.from({ length: rows }, (_, row) => ({ id: makeId(), row, col: 0, rowSpan: 1, colSpan: 1, src: null }))];
        setCols(value => value + 1);
      }
      return next;
    });
  };

  const mergeSelected = (direction: Direction) => {
    if (!selected) return;
    const neighbor = findNeighbor(regions, selected, direction);
    if (!neighbor || !canMerge(selected, neighbor)) {
      toast({ title: "ادغام ممکن نیست", description: "بلوک مجاور وجود ندارد یا هر دو بلوک پر هستند." });
      return;
    }
    const left = Math.min(selected.col, neighbor.col);
    const top = Math.min(selected.row, neighbor.row);
    const right = Math.max(selected.col + selected.colSpan, neighbor.col + neighbor.colSpan);
    const bottom = Math.max(selected.row + selected.rowSpan, neighbor.row + neighbor.rowSpan);
    // Absorb ALL empty regions within the bounding rectangle
    const absorbed: Region[] = [];
    const kept: Region[] = [];
    for (const r of regions) {
      if (r.id === selected.id || r.id === neighbor.id) continue;
      const rRight = r.col + r.colSpan;
      const rBottom = r.row + r.rowSpan;
      if (r.col >= left && rRight <= right && r.row >= top && rBottom <= bottom) {
        absorbed.push(r);
      } else {
        kept.push(r);
      }
    }
    const merged: Region = {
      id: makeId(),
      row: top,
      col: left,
      rowSpan: bottom - top,
      colSpan: right - left,
      src: selected.src || neighbor.src,
      parts: [...(selected.parts ?? [selected]), ...(neighbor.parts ?? [neighbor]), ...absorbed],
    };
    setRegions([...kept, merged]);
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
    // Save layout only on apply (not on close)
    setImageJoiningState({
      regions: regions.map(r => ({ ...r, parts: r.parts?.map(p => ({ ...p })) })),
      rows,
      cols,
      sourceImageRef: result.dataUrl,
    });
    applyComposition(result.dataUrl, result.width, result.height, {
      offsetX: rtlX(originalRegion.col, originalRegion.colSpan, cols, cellWidth),
      offsetY: originalRegion.row * cellHeight,
      scaleX: sx,
      scaleY: sy,
    });
  };

  // ── Panning (single-finger drag) ──────────────────────────────────────
  // Only the outer container's direct background area starts panning.
  // Clicking a block button does NOT start pan (stopPropagation + target check).
  const managerPointerDown = (event: React.PointerEvent) => {
    // Only start pan when the pointer is directly on the background area,
    // not on a child button or other interactive element
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, panX: panRef.current.x, panY: panRef.current.y, hasMoved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const managerPointerMove = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    if (!dragRef.current.hasMoved && Math.abs(dx) + Math.abs(dy) < 3) return;
    dragRef.current.hasMoved = true;
    const newX = dragRef.current.panX + dx;
    const newY = dragRef.current.panY + dy;
    panRef.current = { x: newX, y: newY };
    const inner = panOuterRef.current?.querySelector<HTMLDivElement>(":scope > div");
    if (inner) {
      inner.style.transform = `translate(${newX}px, ${newY}px) scale(${managerZoom})`;
    }
  };

  const managerPointerUp = () => { dragRef.current = null; };

  // ── Pinch-to-zoom ─────────────────────────────────────────────────────
  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      pinchRef.current = { initialDist: dist, initialZoom: managerZoom };
      // Cancel any active single-finger drag
      dragRef.current = null;
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (event.touches.length === 2 && pinchRef.current) {
      event.preventDefault();
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / pinchRef.current.initialDist;
      const newZoom = Math.max(0.5, Math.min(3, pinchRef.current.initialZoom * scale));
      setManagerZoom(newZoom);
      const inner = panOuterRef.current?.querySelector<HTMLDivElement>(":scope > div");
      if (inner) {
        inner.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${newZoom})`;
      }
    }
  };

  const handleTouchEnd = () => { pinchRef.current = null; };

  // Sync zoom state to DOM when zoom changes via buttons
  const syncZoomToDOM = useCallback((z: number) => {
    const inner = panOuterRef.current?.querySelector<HTMLDivElement>(":scope > div");
    if (inner) {
      inner.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${z})`;
    }
  }, []);

  if (!state.sourceImage || !selected) return null;

  return (
    <div className="flex flex-col gap-0.5" dir="rtl">
      {/* Close button — top-right corner */}
      <div className="flex justify-end">
        <button
          className="w-7 h-7 rounded-lg hover:bg-muted text-muted-foreground flex items-center justify-center"
          onClick={close}
          title="بستن"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFile} />

      {/* Block management canvas — with pinch-to-zoom and pan */}
      <div
        ref={panOuterRef}
        data-pan-handle
        className="relative rounded-2xl border border-border bg-muted/50 overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ height: 140, touchAction: "none" }}
        onPointerDown={managerPointerDown}
        onPointerMove={managerPointerMove}
        onPointerUp={managerPointerUp}
        onPointerCancel={managerPointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div data-pan-handle className="relative" style={{ transform: `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${managerZoom})`, transformOrigin: "center", willChange: "transform" }}>
            <div className="grid gap-0.5 bg-border p-0.5 shadow-sm" style={{ gridTemplateColumns: `repeat(${cols}, 40px)`, gridTemplateRows: `repeat(${rows}, 28px)` }}>
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
                    onClick={event => { event.stopPropagation(); setSelectedId(region.id); }}
                    className={`relative flex items-center justify-center rounded-md border-2 text-[8px] font-semibold transition-colors ${
                      selectedId === region.id ? "border-primary ring-2 ring-primary/25" : "border-white/80"
                    } ${region.src ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-400"}`}
                    style={{ gridColumn: `${region.col + 1} / span ${region.colSpan}`, gridRow: `${region.row + 1} / span ${region.rowSpan}`, minHeight: 32 }}
                  >
                    {regionContainsOriginal(region) ? "اصلی" : region.src ? "پر" : "خالی"}
                    {region.parts && region.parts.length > 1 && <span className="absolute top-0.5 left-0.5 text-[7px]">↔</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {/* Zoom controls overlay */}
        <div className="absolute bottom-1 left-1 flex items-center gap-0.5 bg-background/85 rounded-full px-1 py-0.5">
          <button className="w-5 h-5 rounded-full border border-border hover:bg-muted flex items-center justify-center" onClick={() => { const z = Math.max(0.5, managerZoom - 0.15); setManagerZoom(z); syncZoomToDOM(z); }}><Minus className="w-2.5 h-2.5" /></button>
          <span className="text-[8px] font-mono w-7 text-center">{Math.round(managerZoom * 100)}%</span>
          <button className="w-5 h-5 rounded-full border border-border hover:bg-muted flex items-center justify-center" onClick={() => { const z = Math.min(3, managerZoom + 0.15); setManagerZoom(z); syncZoomToDOM(z); }}><Plus className="w-2.5 h-2.5" /></button>
          <button className="w-5 h-5 rounded-full border border-border hover:bg-muted flex items-center justify-center" onClick={() => { setManagerZoom(1); panRef.current = { x: 0, y: 0 }; syncZoomToDOM(1); }}><RotateCcw className="w-2.5 h-2.5" /></button>
        </div>
        <span className="absolute top-1 left-1 bg-background/85 rounded-full px-1.5 py-0.5 text-[7px] text-muted-foreground">برای جابه‌جایی بکشید</span>
      </div>

      {/* Add row buttons — single compact row */}
      <div className="grid grid-cols-4 gap-0.5">
        {([
          ["top", ChevronUp, "↑"],
          ["bottom", ChevronDown, "↓"],
          ["right", ChevronRight, "→"],
          ["left", ChevronLeft, "←"],
        ] as [Direction, React.ElementType, string][]).map(([direction, Icon, arrow]) => (
          <button key={direction} onClick={() => addLine(direction)} className="h-5 rounded-lg border border-dashed border-primary/40 text-[8px] text-primary hover:bg-primary/5 flex items-center justify-center gap-0.5">
            <Icon className="w-2.5 h-2.5" /> + {arrow}
          </button>
        ))}
      </div>

      {/* Fill + Delete + Merge — with labels */}
      <div className="flex items-center gap-1">
        <button onClick={fillSelected} disabled={!!selected.src || regionContainsOriginal(selected)} className="h-8 px-3 rounded-lg bg-primary text-white text-[10px] font-bold disabled:opacity-40 flex items-center gap-1 shrink-0">
          <ImagePlus className="w-3.5 h-3.5" /> پر کردن خانه
        </button>
        <button onClick={removeSelected} className="h-7 px-2 rounded-lg border border-border text-[9px] hover:bg-muted flex items-center gap-0.5 shrink-0">
          <Trash2 className="w-3 h-3 text-destructive" /> حذف
        </button>
        <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
        <span className="text-[8px] text-muted-foreground shrink-0">ادغام:</span>
        {([
          ["left", ChevronRight, "→"],
          ["right", ChevronLeft, "←"],
          ["top", ChevronUp, "↑"],
          ["bottom", ChevronDown, "↓"],
        ] as [Direction, React.ElementType, string][]).map(([direction, Icon, arrow]) => (
          <button key={direction} onClick={() => mergeSelected(direction)} className="h-6 px-1.5 rounded border border-border hover:bg-muted text-[9px] flex items-center justify-center gap-0.5 shrink-0" title={`ادغام ${direction === "right" ? "راست" : direction === "left" ? "چپ" : direction === "top" ? "بالا" : "پایین"}`}>
            <Icon className="w-2.5 h-2.5" /> {arrow}
          </button>
        ))}
        <span className="text-[8px] text-muted-foreground mr-auto">{selected.src ? "پر" : "خالی"}</span>
      </div>

      {/* Separator + Apply row — all on one line */}
      <div className="flex items-center gap-1">
        <label className="flex items-center gap-0.5 text-[8px] cursor-pointer shrink-0">
          <input type="checkbox" checked={separators} onChange={event => setSeparators(event.target.checked)} className="w-3 h-3" />
          خطوط
        </label>
        {separators && <input type="color" value={separatorColor} onChange={event => setSeparatorColor(event.target.value)} className="w-5 h-5 rounded border border-border shrink-0" title="رنگ خطوط" />}
        <div className="flex-1" />
        <button onClick={close} className="h-7 px-2 rounded-lg border border-border text-[9px] hover:bg-muted shrink-0">لغو</button>
        <button onClick={apply} className="h-7 px-3 rounded-lg bg-primary text-white text-[10px] font-bold flex items-center justify-center gap-0.5 shrink-0"><Check className="w-3 h-3" /> اعمال ترکیب</button>
      </div>
    </div>
  );
}
