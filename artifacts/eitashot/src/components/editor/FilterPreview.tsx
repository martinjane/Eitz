import React from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const FILTERS = [
  { id: 'normal', name: 'عادی', style: '' },
  { id: 'vivid', name: 'زنده', style: 'saturate(150%) contrast(110%)' },
  { id: 'cold', name: 'سرد', style: 'sepia(100%) hue-rotate(180deg) saturate(120%)' },
  { id: 'warm', name: 'گرم', style: 'sepia(50%) hue-rotate(330deg) saturate(140%)' },
  { id: 'bw', name: 'سیاه‌سفید', style: 'grayscale(100%)' },
  { id: 'vintage', name: 'قدیمی', style: 'sepia(80%) contrast(120%) brightness(90%)' },
  { id: 'fade', name: 'محو', style: 'brightness(120%) contrast(80%) saturate(80%)' },
];

export default function FilterPreview() {
  const { state, setFilter } = useEditor();

  const handleApplyFilter = (filterId: string, style: string) => {
    setFilter(filterId, style); // history-tracked in EditorContext
  };

  return (
    <ScrollArea className="w-full whitespace-nowrap" dir="rtl">
      <div className="flex w-max space-x-4 space-x-reverse p-4">
        {FILTERS.map(f => {
          const isActive = state.activeFilter === f.id || (!state.activeFilter && f.id === 'normal');
          return (
            <button
              key={f.id}
              onClick={() => handleApplyFilter(f.id, f.style)}
              className="flex flex-col items-center gap-2 group"
            >
              <div 
                className={cn(
                  "w-16 h-16 rounded-xl border-2 overflow-hidden bg-muted transition-all",
                  isActive ? "border-primary scale-110" : "border-transparent group-hover:border-primary/50"
                )}
              >
                {state.sourceImage && (
                  <img 
                    src={state.sourceImage} 
                    alt={f.name}
                    className="w-full h-full object-cover"
                    style={{ filter: f.style }}
                  />
                )}
              </div>
              <span className={cn(
                "text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>{f.name}</span>
            </button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" className="hidden" />
    </ScrollArea>
  );
}
