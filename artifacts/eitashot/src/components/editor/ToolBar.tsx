import React from "react";
import { useEditor } from "@/contexts/EditorContext";
import {
  Crop, Maximize2, RotateCcw, FlipHorizontal2, Type, Paintbrush,
  Wand2, Sliders, ImagePlus, Download, Shield, Droplets, Layers2,
  Wind, SquareAsterisk, PanelLeft, PanelBottom
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ALLOWED_STYLE_TOOLS } from "@/lib/savedStyle";

type Tool = { id: string; icon: React.ElementType; label: string };

const QUICK_TOOLS: Tool[] = [
  { id: "برش", icon: Crop, label: "برش" },
  { id: "تغییر اندازه", icon: Maximize2, label: "اندازه" },
  { id: "چرخش", icon: RotateCcw, label: "چرخش" },
  { id: "وارونه", icon: FlipHorizontal2, label: "وارونه" },
  { id: "متن", icon: Type, label: "متن" },
  { id: "نقاشی", icon: Paintbrush, label: "نقاشی" },
  { id: "فیلتر", icon: Wand2, label: "فیلتر" },
  { id: "تنظیمات", icon: Sliders, label: "تنظیمات" },
  { id: "تصویر", icon: ImagePlus, label: "تصویر" },
  { id: "خروجی", icon: Download, label: "خروجی" },
];

const STUDIO_TOOLS: Tool[] = [
  { id: "برش", icon: Crop, label: "برش" },
  { id: "تغییر اندازه", icon: Maximize2, label: "اندازه" },
  { id: "چرخش", icon: RotateCcw, label: "چرخش" },
  { id: "وارونه", icon: FlipHorizontal2, label: "وارونه" },
  { id: "متن", icon: Type, label: "متن" },
  { id: "نقاشی", icon: Paintbrush, label: "نقاشی" },
  { id: "فیلتر", icon: Wand2, label: "فیلتر" },
  { id: "تنظیمات", icon: Sliders, label: "تنظیمات" },
  { id: "لوگو", icon: Shield, label: "لوگو" },
  { id: "واترمارک", icon: Droplets, label: "واترمارک" },
  { id: "بلور", icon: Wind, label: "بلور" },
  { id: "کادر", icon: SquareAsterisk, label: "کادر" },
  { id: "تصویر", icon: ImagePlus, label: "تصویر" },
  { id: "لایه‌ها", icon: Layers2, label: "لایه‌ها" },
  { id: "خروجی", icon: Download, label: "خروجی" },
];

const STUDIO_EXCLUSIVE = new Set(["لوگو", "واترمارک", "بلور", "کادر", "لایه‌ها"]);

interface ToolBarProps {
  position: "bottom" | "left";
  onToggle: () => void;
}

export default function ToolBar({ position, onToggle }: ToolBarProps) {
  const { state, setTool } = useEditor();
  const baseTools = state.mode === "studio" ? STUDIO_TOOLS : QUICK_TOOLS;
  const tools = state.styleMode ? baseTools.filter(t => ALLOWED_STYLE_TOOLS.has(t.id)) : baseTools;
  const isStudio = state.mode === "studio";
  const isLeft = position === "left";

  const toolButton = (tool: Tool) => {
    const Icon = tool.icon;
    const isActive = state.tool === tool.id;
    const isExclusive = isStudio && STUDIO_EXCLUSIVE.has(tool.id);
    return (
      <button
        key={tool.id}
        onClick={() => setTool(tool.id)}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl gap-0.5 transition-colors text-[10px] font-medium shrink-0",
          isLeft ? "w-[52px] h-[48px]" : "w-[58px] h-[50px]",
          isActive
            ? isStudio
              ? "bg-accent text-accent-foreground shadow-sm"
              : "bg-primary text-white shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted"
        )}
      >
        <Icon className="w-[17px] h-[17px]" />
        <span>{tool.label}</span>
        {isExclusive && !isActive && (
          <span className="absolute top-1 right-1 text-[8px] leading-none text-amber-500" title="ویژه استودیو">★</span>
        )}
      </button>
    );
  };

  /* ── Toggle button ── */
  const toggleBtn = (
    <button
      onClick={onToggle}
      title={isLeft ? "نوار ابزار پایین" : "نوار ابزار چپ"}
      className={cn(
        "flex items-center justify-center rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted shrink-0",
        isLeft ? "w-[52px] h-9 mt-1" : "w-9 h-[50px] mx-1"
      )}
    >
      {isLeft
        ? <PanelBottom className="w-4 h-4" />
        : <PanelLeft className="w-4 h-4" />
      }
    </button>
  );

  /* ── Left (vertical) layout ── */
  if (isLeft) {
    return (
      <div
        className={cn(
          "shrink-0 flex flex-col border-r overflow-y-auto min-h-0 h-full",
          "bg-card border-border"
        )}
        style={{ scrollbarWidth: "none", width: 60 }}
        dir="rtl"
      >
        <div className="flex flex-col items-center gap-0.5 py-1 px-1">
          {toggleBtn}
          <div className="w-8 h-px bg-border my-0.5" />
          {tools.map(toolButton)}
        </div>
      </div>
    );
  }

  /* ── Bottom (horizontal) layout ── */
  return (
    <div
      className={cn(
        "shrink-0 border-t overflow-x-auto",
        "bg-card border-border"
      )}
      dir="rtl"
      style={{ scrollbarWidth: "none" }}
    >
      <div className="flex w-max items-center gap-0.5 px-2 py-1">
        {toggleBtn}
        <div className="h-8 w-px bg-border mx-1" />
        {tools.map(toolButton)}
      </div>
    </div>
  );
}
