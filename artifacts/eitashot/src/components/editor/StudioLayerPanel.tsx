import React from "react";
import { useEditor } from "@/contexts/EditorContext";
import { Layers2 } from "lucide-react";

export default function StudioLayerPanel() {
  const { state, selectLayer, deleteLayer, reorderLayer } = useEditor();

  if (state.layers.length === 0) return null;

  return (
    <div className="shrink-0 bg-card border-t border-border px-3 py-2" dir="rtl">
      <div className="flex items-center gap-2 mb-2">
        <Layers2 className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-foreground">لایه‌ها ({state.layers.length})</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {[...state.layers].reverse().map((layer) => {
          const isSelected = state.selectedLayerId === layer.id;
          const label =
            layer.type === "text" ? `T: ${layer.text?.slice(0, 8)}` :
            layer.type === "image" ? "📷 img" :
            layer.shape === "rect" ? "▭ rect" : "○ circle";
          return (
            <button
              key={layer.id}
              onClick={() => selectLayer(isSelected ? null : layer.id)}
              className={`flex-none flex flex-col items-center justify-center px-2 py-1.5 rounded-lg border text-[10px] font-medium min-w-[56px] transition-colors ${
                isSelected
                  ? "bg-accent border-accent text-accent-foreground"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="truncate max-w-[52px]">{label}</span>
              <div className="flex gap-1 mt-1">
                <span
                  onClick={e => { e.stopPropagation(); reorderLayer(layer.id, "up"); }}
                  className="hover:text-foreground text-[9px] px-0.5"
                >↑</span>
                <span
                  onClick={e => { e.stopPropagation(); deleteLayer(layer.id); }}
                  className="hover:text-destructive text-[9px] px-0.5 text-destructive/70"
                >✕</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
