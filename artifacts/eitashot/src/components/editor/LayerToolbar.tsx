import React, { useRef, useState } from "react";
import { useEditor } from "@/contexts/EditorContext";
import { Trash2, Copy, RotateCw, Plus, Minus, GripHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// 15% per tap — noticeably responsive without being jarring
const SCALE_STEP = 0.15;

export default function LayerToolbar() {
  const { state, deleteLayer, duplicateLayer, updateLayer } = useEditor();
  // Drag offset from the initial centered position
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  if (!state.selectedLayerId || state.tool === "نقاشی") return null;

  const layer = state.layers.find(l => l.id === state.selectedLayerId);
  if (!layer) return null;

  const label = layer.type === "text" ? `"${layer.text?.slice(0, 12)}"` :
    layer.type === "image" ? "تصویر" :
    layer.shape === "rect" ? "مستطیل" : "دایره";

  const shrink = () => {
    const s = 1 - SCALE_STEP;
    updateLayer(layer.id, {
      width:  Math.max(20, layer.width  * s),
      height: Math.max(20, layer.height * s),
      ...(layer.type === "text" && layer.fontSize != null
        ? { fontSize: Math.max(8, Math.round(layer.fontSize * s)) }
        : undefined),
    });
  };

  const grow = () => {
    const s = 1 + SCALE_STEP;
    updateLayer(layer.id, {
      width:  layer.width  * s,
      height: layer.height * s,
      ...(layer.type === "text" && layer.fontSize != null
        ? { fontSize: Math.round(layer.fontSize * s) }
        : undefined),
    });
  };

  const rotate30 = () =>
    updateLayer(layer.id, { rotation: (layer.rotation + 30) % 360 });

  const handleDragStart = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, initX: offset.x, initY: offset.y };
  };
  const handleDragMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.initX + (e.clientX - drag.current.startX),
      y: drag.current.initY + (e.clientY - drag.current.startY),
    });
  };
  const handleDragEnd = () => { drag.current = null; };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        style={{
          left: `calc(50% + ${offset.x}px)`,
          top: `${8 + offset.y}px`,
          transform: "translateX(-50%)",
        }}
        className="absolute top-2 left-1/2 z-40 flex items-center gap-0.5 bg-card border border-border shadow-lg rounded-full px-1.5 py-1"
      >
        {/* Drag handle — label area */}
        <span
          className="text-[10px] text-muted-foreground px-2 max-w-[80px] truncate cursor-grab active:cursor-grabbing select-none flex items-center gap-1"
           onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(e); }}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          style={{ touchAction: "none" }}
        >
          <GripHorizontal className="w-3 h-3 shrink-0 opacity-40" />
          {label}
        </span>
        <div className="w-px h-4 bg-border mx-0.5" />
        {/* Size controls */}
        <ToolBtn onClick={shrink} title="کوچک‌تر">
          <Minus className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={grow} title="بزرگ‌تر">
          <Plus className="w-3.5 h-3.5" />
        </ToolBtn>
        {/* Rotate 30° CW */}
        <ToolBtn onClick={rotate30} title="چرخش ۳۰°">
          <RotateCw className="w-3.5 h-3.5" />
        </ToolBtn>
        {/* Duplicate */}
        <ToolBtn onClick={() => duplicateLayer(state.selectedLayerId!)} title="کپی">
          <Copy className="w-3.5 h-3.5" />
        </ToolBtn>
        <div className="w-px h-4 bg-border mx-0.5" />
        {/* Delete */}
        <ToolBtn onClick={() => deleteLayer(state.selectedLayerId!)} title="حذف" danger>
          <Trash2 className="w-3.5 h-3.5" />
        </ToolBtn>
      </motion.div>
    </AnimatePresence>
  );
}

function ToolBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
