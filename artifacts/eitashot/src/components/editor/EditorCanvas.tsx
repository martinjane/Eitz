import React, { useRef, useEffect, useCallback } from "react";
import { useEditor } from "@/contexts/EditorContext";

/* ─── Image cache ─── */
const IMG_CACHE = new Map<string, HTMLImageElement>();
function loadImg(src: string): Promise<HTMLImageElement> {
  if (IMG_CACHE.has(src)) return Promise.resolve(IMG_CACHE.get(src)!);
  return new Promise(res => {
    const img = new Image();
    img.onload = () => { IMG_CACHE.set(src, img); res(img); };
    img.src = src;
  });
}

/* ─── Crop Overlay ─── */
function CropOverlay({
  canvasRef,
  containerRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { applyCrop, setState } = useEditor();
  const [bounds, setBounds] = React.useState({ left: 0, top: 0, width: 1, height: 1 });
  const [crop, setCrop] = React.useState({ l: 0, t: 0, r: 0, b: 0 });
  const activeHandleRef = useRef<string | null>(null);
  const startRef = useRef({ cx: 0, cy: 0, cl: 0, ct: 0, cr: 0, cb: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const cr = canvasRef.current.getBoundingClientRect();
      const pr = containerRef.current.getBoundingClientRect();
      setBounds({ left: cr.left - pr.left, top: cr.top - pr.top, width: Math.max(cr.width, 1), height: Math.max(cr.height, 1) });
    };
    update();
    const ro = new ResizeObserver(update);
    if (canvasRef.current) ro.observe(canvasRef.current);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  const startDrag = (handle: string, e: React.PointerEvent) => {
    e.stopPropagation();
    overlayRef.current?.setPointerCapture(e.pointerId);
    activeHandleRef.current = handle;
    startRef.current = { cx: e.clientX, cy: e.clientY, cl: crop.l, ct: crop.t, cr: crop.r, cb: crop.b };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!activeHandleRef.current) return;
    const { cx, cy, cl, ct, cr: sr, cb } = startRef.current;
    const dx = (e.clientX - cx) / bounds.width * 100;
    const dy = (e.clientY - cy) / bounds.height * 100;
    const MAX = 47;
    const h = activeHandleRef.current;
    setCrop(() => ({
      l: h.includes("l") ? Math.max(0, Math.min(MAX, cl + dx)) : cl,
      t: h.includes("t") ? Math.max(0, Math.min(MAX, ct + dy)) : ct,
      r: h.includes("r") ? Math.max(0, Math.min(MAX, sr - dx)) : sr,
      b: h.includes("b") ? Math.max(0, Math.min(MAX, cb - dy)) : cb,
    }));
  };

  const { l, t, r, b } = crop;

  return (
    <div
      ref={overlayRef}
      className="absolute touch-none"
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height, zIndex: 20 }}
      onPointerMove={onMove}
      onPointerUp={() => { activeHandleRef.current = null; }}
    >
      <div className="absolute top-0 left-0 right-0 bg-black/55 pointer-events-none" style={{ height: `${t}%` }} />
      <div className="absolute bottom-0 left-0 right-0 bg-black/55 pointer-events-none" style={{ height: `${b}%` }} />
      <div className="absolute bg-black/55 pointer-events-none" style={{ left: 0, top: `${t}%`, bottom: `${b}%`, width: `${l}%` }} />
      <div className="absolute bg-black/55 pointer-events-none" style={{ right: 0, top: `${t}%`, bottom: `${b}%`, width: `${r}%` }} />
      <div className="absolute border-2 border-primary pointer-events-none overflow-hidden" style={{ left: `${l}%`, top: `${t}%`, right: `${r}%`, bottom: `${b}%` }}>
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.14) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.14) 1px,transparent 1px)", backgroundSize: "33.33% 33.33%" }} />
      </div>
      {/* Corner handles */}
      {([["tl", { left: `${l}%`, top: `${t}%`, transform: "translate(-50%,-50%)" }],
        ["tr", { right: `${r}%`, top: `${t}%`, transform: "translate(50%,-50%)" }],
        ["bl", { left: `${l}%`, bottom: `${b}%`, transform: "translate(-50%,50%)" }],
        ["br", { right: `${r}%`, bottom: `${b}%`, transform: "translate(50%,50%)" }],
      ] as [string, React.CSSProperties][]).map(([k, s]) => (
        <div key={k} className="absolute w-6 h-6 bg-primary border-2 border-white rounded shadow-md" style={s} onPointerDown={e => startDrag(k, e)} />
      ))}
      {/* Edge handles */}
      {([["t", { left: "50%", top: `${t}%`, transform: "translate(-50%,-50%)" }],
        ["b", { left: "50%", bottom: `${b}%`, transform: "translate(-50%,50%)" }],
        ["l", { left: `${l}%`, top: "50%", transform: "translate(-50%,-50%)" }],
        ["r", { right: `${r}%`, top: "50%", transform: "translate(50%,-50%)" }],
      ] as [string, React.CSSProperties][]).map(([k, s]) => (
        <div key={k} className="absolute w-5 h-5 bg-primary/85 border border-white rounded shadow" style={s} onPointerDown={e => startDrag(k, e)} />
      ))}
      {/* Buttons */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-30">
        <button className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg"
          onPointerDown={e => e.stopPropagation()} onClick={() => applyCrop({ l, t, r, b })}>
          ✓ اعمال برش
        </button>
        <button className="bg-white/90 text-foreground px-4 py-2 rounded-xl text-sm font-medium shadow-lg border border-border"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => setState(s => ({ ...s, tool: "", cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0 }))}>
          لغو
        </button>
      </div>
    </div>
  );
}

/* ─── Main EditorCanvas ─── */
type PtrData = { screenX: number; screenY: number; canvasX: number; canvasY: number };

export default function EditorCanvas() {
  const { state, selectLayer, updateLayer, addLayer } = useEditor();
  const displaySourceImage = state.compositionPreview || state.sourceImage;
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportDivRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseImgRef = useRef<HTMLImageElement | null>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const zoomSliderRef = useRef<HTMLInputElement>(null);

  // Separate offscreen canvas for paint strokes — prevents filter compounding
  // and layer capture when strokes are baked back into sourceImage.
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Viewport pan/zoom via ref (no React state = no re-renders during gesture)
  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });
  const minScaleRef = useRef(0.3);

  // rAF render loop refs
  const renderFnRef = useRef<(() => void) | null>(null);
  const isDirtyRef = useRef(true);
  const rafRef = useRef(0);

  // Layer interaction overrides
  const dragOverrideRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const sizeOverrideRef = useRef<{ id: string; w: number; h: number; fontSize?: number } | null>(null);
  const dragStartRef = useRef<{ id: string; offX: number; offY: number; curX: number; curY: number } | null>(null);

  // Multi-touch tracking
  const pointersRef = useRef<Map<number, PtrData>>(new Map());

  // Gesture refs
  const panRef = useRef<{ pointerId: number; startScreenX: number; startScreenY: number; startVpX: number; startVpY: number } | null>(null);
  const pinchZoomRef = useRef<{ prevDist: number; prevMidX: number; prevMidY: number } | null>(null);
  const pinchResizeRef = useRef<{ layerId: string; startDist: number; startW: number; startH: number; startFontSize?: number } | null>(null);

  // Draw
  const isDrawingRef = useRef(false);
  const lastDrawPtRef = useRef<{ x: number; y: number } | null>(null);

  // ── Single state mirror — ALL pointer handlers read from this ref ──────────
  // This is the key paint-performance fix: pointer handlers (down/move/up) have
  // ZERO React state dependencies, so they are created exactly ONCE for the
  // lifetime of the component and never re-registered mid-stroke.
  // React state changes (new layers, color changes, etc.) update the ref via
  // a simple useEffect; the handlers always see the latest values.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }); // no dep array → runs after every render

  // Double-tap
  const lastTapRef = useRef<{ time: number } | null>(null);

  // Layer image cache
  const layerImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  /* ── Viewport helpers ── */
  const applyViewportTransform = useCallback(() => {
    if (!viewportDivRef.current) return;
    const { x, y, scale } = viewportRef.current;
    viewportDivRef.current.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    const pct = Math.round(scale * 100);
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${pct}%`;
    if (zoomSliderRef.current) zoomSliderRef.current.value = String(pct);
  }, []);

  const resetViewport = useCallback(() => {
    const container = containerRef.current;
    const img = baseImgRef.current;
    if (!container || !img || !img.width) return;
    const rect = container.getBoundingClientRect();
    const pad = 20;
    const fitScale = Math.min((rect.width - pad * 2) / img.width, (rect.height - pad * 2) / img.height);
    minScaleRef.current = Math.min(0.3, fitScale * 0.5);
    if (zoomSliderRef.current) zoomSliderRef.current.min = String(Math.round(minScaleRef.current * 100));
    viewportRef.current = {
      x: (rect.width - img.width * fitScale) / 2,
      y: (rect.height - img.height * fitScale) / 2,
      scale: fitScale,
    };
    applyViewportTransform();
  }, [applyViewportTransform]);

  /* ── Zoom via slider ── */
  const handleSliderZoom = useCallback((pct: number) => {
    const newScale = Math.max(minScaleRef.current, Math.min(6, pct / 100));
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const ratio = newScale / viewportRef.current.scale;
    viewportRef.current = {
      x: cx + (viewportRef.current.x - cx) * ratio,
      y: cy + (viewportRef.current.y - cy) * ratio,
      scale: newScale,
    };
    applyViewportTransform();
  }, [applyViewportTransform]);

  /* ── Image loading + paint canvas init ── */
  useEffect(() => {
    if (!displaySourceImage) return;
    loadImg(displaySourceImage).then(img => {
      baseImgRef.current = img;
      // Reset the paint canvas to match the new image dimensions
      const pc = document.createElement("canvas");
      pc.width = img.width;
      pc.height = img.height;
      paintCanvasRef.current = pc;
      isDirtyRef.current = true;
      setTimeout(resetViewport, 30);
    });
  }, [displaySourceImage, resetViewport]);

  /* ── Layer image preloader ── */
  useEffect(() => {
    state.layers.forEach(l => {
      if (l.type === "image" && l.src && !layerImgCacheRef.current.has(l.src)) {
        const img = new Image();
        img.onload = () => { layerImgCacheRef.current.set(l.src!, img); isDirtyRef.current = true; };
        img.src = l.src;
      }
    });
  }, [state.layers]);

  /* ── Build render function (fresh closure on state change) ── */
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
      const { adjustments, activeFilterStyle, layers, selectedLayerId, compositionPreviewTransform } = state;

    renderFnRef.current = () => {
      const img = baseImgRef.current;
      if (!img) return;
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ① Draw base image with filters applied once as a compositing stage
      const { brightness, contrast, saturation } = adjustments;
      const filterStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) ${activeFilterStyle || ""}`.trim();
      ctx.filter = filterStr;
      ctx.drawImage(img, 0, 0);
      ctx.filter = "none";

      // ② Draw object layers — no filter applied here
      layers.forEach(layer => {
        const dragOv = dragOverrideRef.current?.id === layer.id ? dragOverrideRef.current : null;
         const sizeOv = sizeOverrideRef.current?.id === layer.id ? sizeOverrideRef.current : null;
         const previewTransform = state.compositionPreview ? compositionPreviewTransform : null;
         const baseX = dragOv?.x ?? layer.x;
         const baseY = dragOv?.y ?? layer.y;
         const baseW = sizeOv?.w ?? layer.width;
         const baseH = sizeOv?.h ?? layer.height;
         const lx = previewTransform ? previewTransform.offsetX + baseX * previewTransform.scaleX : baseX;
         const ly = previewTransform ? previewTransform.offsetY + baseY * previewTransform.scaleY : baseY;
         const lw = previewTransform ? baseW * previewTransform.scaleX : baseW;
         const lh = previewTransform ? baseH * previewTransform.scaleY : baseH;

        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.translate(lx, ly);
        ctx.rotate((layer.rotation * Math.PI) / 180);

        if (layer.type === "text" && layer.text) {
           const fs = sizeOv?.fontSize ?? layer.fontSize ?? 48;
          ctx.font = `bold ${fs}px Vazirmatn, sans-serif`;
          ctx.fillStyle = layer.color || "#111";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0,0,0,0.55)";
          ctx.shadowBlur = fs / 5;
          ctx.fillText(layer.text, 0, 0);
          ctx.shadowBlur = 0;
        } else if (layer.type === "image") {
          const li = layerImgCacheRef.current.get(layer.src || "");
          if (li) ctx.drawImage(li, -lw / 2, -lh / 2, lw, lh);
        } else if (layer.type === "shape") {
          ctx.fillStyle = layer.fill || "transparent";
          ctx.strokeStyle = layer.stroke || "transparent";
          ctx.lineWidth = (layer.strokeWidth || 4) * (canvas.width / 1000);
          ctx.beginPath();
          if (layer.shape === "rect") ctx.rect(-lw / 2, -lh / 2, lw, lh);
          else ctx.arc(0, 0, lw / 2, 0, Math.PI * 2);
          if (layer.fill && layer.fill !== "transparent") ctx.fill();
          if (layer.stroke && layer.stroke !== "transparent") ctx.stroke();
        }

        if (selectedLayerId === layer.id) {
          ctx.strokeStyle = "hsl(22,88%,47%)";
          ctx.lineWidth = Math.max(2, canvas.width / 300);
          ctx.setLineDash([8, 4]);
          // For text layers: use ctx.measureText() for an accurate selection
          // box rather than the rough character-count estimate stored in layer.width.
          // ctx.font is already set from the text-rendering block above.
          let boxW = lw;
          let boxH = lh;
          if (layer.type === "text" && layer.text) {
            const fs = layer.fontSize || 48;
            boxW = ctx.measureText(layer.text).width;
            boxH = fs * 1.25;
          }
          ctx.strokeRect(-boxW / 2 - 16, -boxH / 2 - 16, boxW + 32, boxH + 32);
          ctx.setLineDash([]);
        }
        ctx.restore();
      });

      // ③ Overlay the in-progress paint canvas (no filter — renders on top of layers)
      const pc = paintCanvasRef.current;
      if (pc) {
        ctx.drawImage(pc, 0, 0);
      }
    };
    isDirtyRef.current = true;
   }, [state]);

  /* ── rAF loop — runs regardless of drawing state ── */
  useEffect(() => {
    const tick = () => {
      if (isDirtyRef.current && renderFnRef.current) {
        renderFnRef.current();
        isDirtyRef.current = false;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  /* ── Canvas coordinate mapping ── */
  const toCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  /* ── Pointer handlers ── */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x: canvasX, y: canvasY } = toCanvasCoords(e.clientX, e.clientY);
    pointersRef.current.set(e.pointerId, { screenX: e.clientX, screenY: e.clientY, canvasX, canvasY });

    const pts = [...pointersRef.current.values()];

    // Double-tap → reset zoom (single-finger ONLY)
    const now = Date.now();
    if (pts.length === 1) {
      if (lastTapRef.current && now - lastTapRef.current.time < 300) {
        resetViewport(); lastTapRef.current = null; return;
      }
      lastTapRef.current = { time: now };
    } else {
      lastTapRef.current = null;
    }

    if (stateRef.current.tool === "نقاشی") {
      isDrawingRef.current = true;
      lastDrawPtRef.current = { x: canvasX, y: canvasY };
      return;
    }
    if (stateRef.current.tool === "برش") return;

    // 2 fingers → start pinch (cancel any single-pointer gesture)
    if (pts.length >= 2) {
      // Keep dragOverrideRef alive so the layer stays at its current dragged
      // position. It will be committed when the pinch ends in handlePointerUp.
      dragStartRef.current = null;
      panRef.current = null;

      const dist = Math.hypot(pts[1].screenX - pts[0].screenX, pts[1].screenY - pts[0].screenY);
      const midX = (pts[0].screenX + pts[1].screenX) / 2;
      const midY = (pts[0].screenY + pts[1].screenY) / 2;

      if (stateRef.current.selectedLayerId) {
        const layer = stateRef.current.layers.find(l => l.id === stateRef.current.selectedLayerId);
        if (layer) {
          pinchResizeRef.current = {
            layerId: stateRef.current.selectedLayerId,
            startDist: dist,
            startW: layer.width,
            startH: layer.height,
            // Capture current fontSize so pinch can scale it alongside width/height
            startFontSize: layer.type === "text" ? (layer.fontSize ?? 48) : undefined,
          };
          return;
        }
      }

      pinchZoomRef.current = { prevDist: dist, prevMidX: midX, prevMidY: midY };
      return;
    }

    // 1 finger: hit-test layers first (paint layers are never selectable)
    if (!stateRef.current.tool || stateRef.current.tool === "لایه‌ها") {
      for (let i = stateRef.current.layers.length - 1; i >= 0; i--) {
        const l = stateRef.current.layers[i];
        if (l.isPaint) continue; // paint layers are not interactive objects
        const hw = l.width / 2 + 30;
        const hh = l.height / 2 + 30;
        if (canvasX >= l.x - hw && canvasX <= l.x + hw && canvasY >= l.y - hh && canvasY <= l.y + hh) {
          selectLayer(l.id);
          dragStartRef.current = { id: l.id, offX: canvasX - l.x, offY: canvasY - l.y, curX: l.x, curY: l.y };
          return;
        }
      }
      selectLayer(null);
    }

    // No layer hit → pan
    panRef.current = { pointerId: e.pointerId, startScreenX: e.clientX, startScreenY: e.clientY, startVpX: viewportRef.current.x, startVpY: viewportRef.current.y };
  // stateRef always current — no state deps needed here
  }, [toCanvasCoords, selectLayer, resetViewport]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const { x: canvasX, y: canvasY } = toCanvasCoords(e.clientX, e.clientY);
    pointersRef.current.set(e.pointerId, { screenX: e.clientX, screenY: e.clientY, canvasX, canvasY });
    const pts = [...pointersRef.current.values()];

    // Paint — draw onto the separate paint canvas.
    // stateRef.current is always fresh without being a dep, so this callback
    // is never recreated mid-stroke — no pointer-capture loss, no jitter.
    if (stateRef.current.tool === "نقاشی" && isDrawingRef.current) {
      const pc = paintCanvasRef.current;
      if (!pc) return;
      const ctx = pc.getContext("2d")!;
      if (lastDrawPtRef.current) {
        ctx.beginPath();
        ctx.moveTo(lastDrawPtRef.current.x, lastDrawPtRef.current.y);
        ctx.lineTo(canvasX, canvasY);
        ctx.strokeStyle = stateRef.current.drawColor;
        ctx.lineWidth = stateRef.current.drawSize * (pc.width / 400);
        ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
      }
      lastDrawPtRef.current = { x: canvasX, y: canvasY };
      isDirtyRef.current = true;
      return;
    }

    if (pts.length >= 2) {
      // Pinch-resize layer
      if (pinchResizeRef.current) {
        const dist = Math.hypot(pts[1].screenX - pts[0].screenX, pts[1].screenY - pts[0].screenY);
        const scale = dist / pinchResizeRef.current.startDist;
         const w = Math.max(40, pinchResizeRef.current.startW * scale);
         sizeOverrideRef.current = {
           id: pinchResizeRef.current.layerId,
           w,
           h: Math.max(40, pinchResizeRef.current.startH * scale),
           fontSize: pinchResizeRef.current.startFontSize != null
             ? Math.max(8, pinchResizeRef.current.startFontSize * scale)
             : undefined,
         };
        isDirtyRef.current = true;
        return;
      }

      // Lazy-init pinch zoom
      if (!pinchZoomRef.current) {
        const dist = Math.hypot(pts[1].screenX - pts[0].screenX, pts[1].screenY - pts[0].screenY);
        if (dist > 0) {
          pinchZoomRef.current = {
            prevDist: dist,
            prevMidX: (pts[0].screenX + pts[1].screenX) / 2,
            prevMidY: (pts[0].screenY + pts[1].screenY) / 2,
          };
        }
        panRef.current = null;
        return;
      }

      // Pinch-zoom viewport — incremental deltas
      if (pinchZoomRef.current) {
        const dist = Math.hypot(pts[1].screenX - pts[0].screenX, pts[1].screenY - pts[0].screenY);
        const midX = (pts[0].screenX + pts[1].screenX) / 2;
        const midY = (pts[0].screenY + pts[1].screenY) / 2;
        const { prevDist, prevMidX, prevMidY } = pinchZoomRef.current;
        const rect = containerRef.current!.getBoundingClientRect();

        const scaleDelta = prevDist > 0 ? dist / prevDist : 1;
        const oldScale = viewportRef.current.scale;
        const newScale = Math.max(minScaleRef.current, Math.min(6, oldScale * scaleDelta));
        const actualRatio = newScale / oldScale;

        const pivotX = midX - rect.left;
        const pivotY = midY - rect.top;
        const panDX = midX - prevMidX;
        const panDY = midY - prevMidY;

        viewportRef.current = {
          x: pivotX + (viewportRef.current.x - pivotX) * actualRatio + panDX,
          y: pivotY + (viewportRef.current.y - pivotY) * actualRatio + panDY,
          scale: newScale,
        };

        pinchZoomRef.current = { prevDist: dist, prevMidX: midX, prevMidY: midY };
        applyViewportTransform();
        return;
      }
    }

    // Layer drag (single finger only)
    if (dragStartRef.current && pts.length === 1) {
      const newX = canvasX - dragStartRef.current.offX;
      const newY = canvasY - dragStartRef.current.offY;
      dragStartRef.current.curX = newX; dragStartRef.current.curY = newY;
      dragOverrideRef.current = { id: dragStartRef.current.id, x: newX, y: newY };
      isDirtyRef.current = true;
      return;
    }

    // Pan
    if (panRef.current && pts.length === 1) {
      viewportRef.current.x = panRef.current.startVpX + (e.clientX - panRef.current.startScreenX);
      viewportRef.current.y = panRef.current.startVpY + (e.clientY - panRef.current.startScreenY);
      applyViewportTransform();
    }
  // drawStateRef kept in sync via useEffect — no need for those values here
  }, [toCanvasCoords, applyViewportTransform]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    const remaining = pointersRef.current.size;

    // Paint stroke ended — convert paint canvas to a persistent image layer
    if (isDrawingRef.current && remaining === 0) {
      const pc = paintCanvasRef.current;
      if (pc) {
        // Export as PNG to preserve transparency
        const src = pc.toDataURL("image/png");
        // Add as a paint layer — composites normally but is not selectable/movable
        addLayer({
          type: "image",
          src,
          x: pc.width / 2,
          y: pc.height / 2,
          width: pc.width,
          height: pc.height,
          rotation: 0,
          opacity: 1,
          isPaint: true,
        });
        // Reset paint canvas for next stroke
        const ctx = pc.getContext("2d")!;
        ctx.clearRect(0, 0, pc.width, pc.height);
      }
      isDrawingRef.current = false;
      lastDrawPtRef.current = null;
      return;
    }

    if (pinchResizeRef.current && sizeOverrideRef.current) {
      const { layerId, startW, startFontSize } = pinchResizeRef.current;
      const newW = sizeOverrideRef.current.w;
      const newH = sizeOverrideRef.current.h;
      // For text layers, scale fontSize proportionally so the text itself
      // grows/shrinks — not just the invisible bounding box.
      const fontUpdate =
        startFontSize != null && startW > 0
          ? { fontSize: Math.max(8, Math.round(startFontSize * (newW / startW))) }
          : {};
      // If the layer was being dragged when the pinch started, dragOverrideRef
      // holds the committed drag position — include it so the layer stays where
      // it was dragged to rather than snapping back.
      const posUpdate =
        dragOverrideRef.current?.id === layerId
          ? { x: dragOverrideRef.current.x, y: dragOverrideRef.current.y }
          : {};
      updateLayer(layerId, { width: newW, height: newH, ...fontUpdate, ...posUpdate });
      sizeOverrideRef.current = null;
      if (posUpdate.x !== undefined) dragOverrideRef.current = null;
    }
    if (remaining < 2) {
      pinchResizeRef.current = null;
      pinchZoomRef.current = null;
      if (remaining === 1) {
        const [remainingId, remainingPt] = [...pointersRef.current.entries()][0];
        panRef.current = {
          pointerId: remainingId,
          startScreenX: remainingPt.screenX,
          startScreenY: remainingPt.screenY,
          startVpX: viewportRef.current.x,
          startVpY: viewportRef.current.y,
        };
      }
    }

    if (dragStartRef.current && dragOverrideRef.current) {
      updateLayer(dragStartRef.current.id, { x: dragStartRef.current.curX, y: dragStartRef.current.curY });
      dragOverrideRef.current = null; dragStartRef.current = null;
    }
    if (panRef.current?.pointerId === e.pointerId) panRef.current = null;
  }, [addLayer, updateLayer]);

  const isCropMode = state.tool === "برش";
  const rotTransform = state.tool === "چرخش" && state.rotation !== 0 ? `rotate(${state.rotation}deg)` : undefined;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden touch-none select-none"
      onPointerDown={isCropMode ? undefined : handlePointerDown}
      onPointerMove={isCropMode ? undefined : handlePointerMove}
      onPointerUp={isCropMode ? undefined : handlePointerUp}
      onPointerCancel={isCropMode ? undefined : handlePointerUp}
    >
      {/* Viewport div — receives the pan/zoom transform */}
      <div ref={viewportDivRef} className="absolute" style={{ top: 0, left: 0, transformOrigin: "0 0", willChange: "transform" }}>
        <canvas
          id="eitashot-canvas"
          ref={canvasRef}
          style={{
            display: "block",
            touchAction: "none",
            transform: rotTransform,
            transition: rotTransform ? "transform 0.05s linear" : undefined,
            cursor: state.tool === "نقاشی" ? "crosshair" : "default",
            borderRadius: "8px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
          }}
        />
      </div>

      {/* Zoom controls */}
      <div
        className="absolute bottom-3 right-3 z-10 flex items-center gap-1 bg-background/85 backdrop-blur border border-border px-2 py-1.5 rounded-xl shadow"
        dir="ltr"
        onPointerDown={e => e.stopPropagation()}
        onPointerMove={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
      >
        <button
          className="w-5 h-5 flex items-center justify-center text-base leading-none text-muted-foreground hover:text-foreground rounded transition-colors"
          onClick={() => handleSliderZoom(viewportRef.current.scale * 100 / 1.25)}
          title="کوچک‌تر"
        >−</button>
        <input
          ref={zoomSliderRef}
          type="range"
          min="10"
          max="600"
          defaultValue="100"
          step="1"
          className="w-14 cursor-pointer"
          style={{ accentColor: "hsl(22 88% 47%)", height: "3px" }}
          onChange={e => handleSliderZoom(parseInt(e.target.value))}
        />
        <button
          className="w-5 h-5 flex items-center justify-center text-base leading-none text-muted-foreground hover:text-foreground rounded transition-colors"
          onClick={() => handleSliderZoom(viewportRef.current.scale * 100 * 1.25)}
          title="بزرگ‌تر"
        >+</button>
        <button
          className="text-[10px] font-mono text-muted-foreground hover:text-foreground min-w-[30px] text-center transition-colors"
          onClick={resetViewport}
          title="ریست زوم"
        >
          <span ref={zoomLabelRef}>100%</span>
        </button>
      </div>

      {isCropMode && <CropOverlay canvasRef={canvasRef} containerRef={containerRef} />}
    </div>
  );
}
