import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { MAX_STYLE_OBJECTS } from '@/lib/savedStyle';
import { getDeviceResolution } from '@/lib/deviceCapability';

export type LayerType = 'text' | 'image' | 'shape';
export type EditorMode = 'quick' | 'studio';

export type Layer = {
  id: string;
  type: LayerType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  text?: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  src?: string;
  /** Persistent logo reference — used when this layer came from a saved logo. */
  logo_id?: number;
  shape?: 'rect' | 'circle';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /**
   * True for layers created by the paint tool. Paint layers are committed to
   * the canvas as flattened image data and must never be selectable or movable
   * as independent objects.
   */
  isPaint?: boolean;
};

export type Adjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
};

export type EditorState = {
  sourceImage: string | null;
  imageWidth: number;
  imageHeight: number;
  layers: Layer[];
  selectedLayerId: string | null;
  adjustments: Adjustments;
  activeFilter: string;
  activeFilterStyle: string;
  cropLeft: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  tool: string;
  mode: EditorMode;
  drawColor: string;
  drawSize: number;
  /** True while creating/editing a Saved Style: restricts tools + hard-caps object count. */
  styleMode: boolean;
  styleLimitWarning: string | null;
};

// Only the fields that matter for undo/redo
type HistorySnapshot = Pick<
  EditorState,
  | 'sourceImage' | 'imageWidth' | 'imageHeight'
  | 'layers' | 'adjustments' | 'activeFilter' | 'activeFilterStyle'
  | 'flipH' | 'flipV'
>;

type EditorContextType = {
  state: EditorState;
  setState: React.Dispatch<React.SetStateAction<EditorState>>;
  setMode: (mode: EditorMode) => void;
  setTool: (tool: string) => void;
  updateAdjustment: (key: keyof Adjustments, value: number) => void;
  resetAdjustments: () => void;
  setFilter: (id: string, style: string) => void;
  addLayer: (layer: Omit<Layer, 'id'>) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  deleteLayer: (id: string) => void;
  selectLayer: (id: string | null) => void;
  reorderLayer: (id: string, dir: 'up' | 'down') => void;
  duplicateLayer: (id: string) => void;
  applyCrop: (cropValues?: { l: number; t: number; r: number; b: number }) => void;
  applyResize: (w: number, h: number) => void;
  applyRotate: (deg: number) => void;
  applyFlip: (axis: 'h' | 'v') => void;
  applyBlur: (amount: number) => void;
  applyFrame: (width: number, color: string) => void;
  loadImage: (dataUrl: string) => void;
  exportCanvas: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  enterStyleMode: () => void;
  exitStyleMode: () => void;
  clearStyleLimitWarning: () => void;
};

const MAX_HISTORY = 20;

const defaultState: EditorState = {
  sourceImage: null,
  imageWidth: 0,
  imageHeight: 0,
  layers: [],
  selectedLayerId: null,
  adjustments: { brightness: 100, contrast: 100, saturation: 100 },
  activeFilter: 'normal',
  activeFilterStyle: '',
  cropLeft: 0,
  cropTop: 0,
  cropRight: 0,
  cropBottom: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  tool: '',
  mode: 'quick',
  drawColor: '#E05A0C',
  drawSize: 10,
  styleMode: false,
  styleLimitWarning: null,
};

const EditorContext = createContext<EditorContextType | undefined>(undefined);

function makeSnapshot(s: EditorState): HistorySnapshot {
  return {
    sourceImage: s.sourceImage,
    imageWidth: s.imageWidth,
    imageHeight: s.imageHeight,
    layers: s.layers,
    adjustments: { ...s.adjustments },
    activeFilter: s.activeFilter,
    activeFilterStyle: s.activeFilterStyle,
    flipH: s.flipH,
    flipV: s.flipV,
  };
}

function downsampleIfNeeded(dataUrl: string): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const maxDim = Math.max(img.width, img.height);
      // Use device-appropriate limit instead of a fixed constant.
      // getDeviceResolution() is cached after first call so this is cheap.
      const limit = getDeviceResolution();
      if (maxDim <= limit) { resolve(dataUrl); return; }
      const scale = limit / maxDim;
      const newW = Math.round(img.width * scale);
      const newH = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = newW; canvas.height = newH;
      canvas.getContext('2d')!.drawImage(img, 0, 0, newW, newH);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = dataUrl;
  });
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EditorState>(defaultState);

  // Mirror of state in a ref — always current, safe to read synchronously
  const stateRef = useRef(state);
  stateRef.current = state;

  // History stacks — refs to avoid driving re-renders on every push
  const pastRef = useRef<HistorySnapshot[]>([]);
  const futureRef = useRef<HistorySnapshot[]>([]);
  // Separate counters state just to trigger re-renders for canUndo/canRedo
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });

  /** Push current state onto the undo stack and clear the redo stack. */
  const recordHistory = useCallback(() => {
    const snap = makeSnapshot(stateRef.current);
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snap];
    futureRef.current = [];
    setHistorySize({ past: pastRef.current.length, future: 0 });
  }, []);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const snap = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [makeSnapshot(stateRef.current), ...futureRef.current.slice(0, MAX_HISTORY - 1)];
    setState(s => ({ ...s, ...snap }));
    setHistorySize({ past: pastRef.current.length, future: futureRef.current.length });
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const snap = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), makeSnapshot(stateRef.current)];
    setState(s => ({ ...s, ...snap }));
    setHistorySize({ past: pastRef.current.length, future: futureRef.current.length });
  }, []);

  const canUndo = historySize.past > 0;
  const canRedo  = historySize.future > 0;

  /* ─── Non-destructive: no history ─── */

  const loadImage = useCallback((dataUrl: string) => {
    downsampleIfNeeded(dataUrl).then(optimized => {
      const img = new Image();
      img.onload = () => {
        // Clear history when a new image is loaded
        pastRef.current = [];
        futureRef.current = [];
        setHistorySize({ past: 0, future: 0 });
        setState(s => ({
          ...defaultState,
          sourceImage: optimized,
          imageWidth: img.width,
          imageHeight: img.height,
          mode: s.mode,
        }));
      };
      img.src = optimized;
    });
  }, []);

  const setMode = useCallback((mode: EditorMode) => {
    setState(s => ({ ...s, mode, tool: '' }));
  }, []);

  const setTool = useCallback((tool: string) => {
    setState(s => ({ ...s, tool: s.tool === tool ? '' : tool, selectedLayerId: null }));
  }, []);

  const updateAdjustment = useCallback((key: keyof Adjustments, value: number) => {
    setState(s => ({ ...s, adjustments: { ...s.adjustments, [key]: value } }));
  }, []);

  const resetAdjustments = useCallback(() => {
    recordHistory();
    setState(s => ({ ...s, adjustments: { brightness: 100, contrast: 100, saturation: 100 } }));
  }, [recordHistory]);

  const selectLayer = useCallback((id: string | null) => {
    setState(s => {
      if (!id) return { ...s, selectedLayerId: null };
      // Auto bring-to-front: move the selected layer to the top of the stack
      // (end of the array = rendered last = visually on top).
      // This does NOT push a history entry — it is a view-convenience behaviour,
      // not a content action the user would want to undo.
      const idx = s.layers.findIndex(l => l.id === id);
      if (idx < 0 || idx === s.layers.length - 1) {
        // Already on top (or not found) — just update selection
        return { ...s, selectedLayerId: id };
      }
      const newLayers = [...s.layers];
      const [moved] = newLayers.splice(idx, 1);
      newLayers.push(moved);
      return { ...s, layers: newLayers, selectedLayerId: id };
    });
  }, []);

  /* ─── History-tracked operations ─── */

  const setFilter = useCallback((id: string, style: string) => {
    recordHistory();
    setState(s => ({ ...s, activeFilter: id, activeFilterStyle: style }));
  }, [recordHistory]);

  const addLayer = useCallback((layerData: Omit<Layer, 'id'>) => {
    const s = stateRef.current;
    if (s.styleMode && s.layers.length >= MAX_STYLE_OBJECTS) {
      setState(prev => ({ ...prev, styleLimitWarning: `حداکثر ${MAX_STYLE_OBJECTS} شیء در یک استایل مجاز است. ابتدا یکی را حذف کنید.` }));
      return;
    }
    recordHistory();
    const newLayer: Layer = { ...layerData, id: Math.random().toString(36).substr(2, 9) };
    // Paint layers must not auto-select — they are not movable objects
    setState(s => ({
      ...s,
      layers: [...s.layers, newLayer],
      selectedLayerId: newLayer.isPaint ? s.selectedLayerId : newLayer.id,
      styleLimitWarning: null,
    }));
  }, [recordHistory]);

  const updateLayer = useCallback((id: string, updates: Partial<Layer>) => {
    recordHistory();
    setState(s => ({ ...s, layers: s.layers.map(l => l.id === id ? { ...l, ...updates } : l) }));
  }, [recordHistory]);

  const deleteLayer = useCallback((id: string) => {
    recordHistory();
    setState(s => ({
      ...s,
      layers: s.layers.filter(l => l.id !== id),
      selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
    }));
  }, [recordHistory]);

  const reorderLayer = useCallback((id: string, dir: 'up' | 'down') => {
    recordHistory();
    setState(s => {
      const idx = s.layers.findIndex(l => l.id === id);
      const newLayers = [...s.layers];
      if (dir === 'up' && idx < newLayers.length - 1) [newLayers[idx], newLayers[idx + 1]] = [newLayers[idx + 1], newLayers[idx]];
      else if (dir === 'down' && idx > 0) [newLayers[idx], newLayers[idx - 1]] = [newLayers[idx - 1], newLayers[idx]];
      return { ...s, layers: newLayers };
    });
  }, [recordHistory]);

  const duplicateLayer = useCallback((id: string) => {
    recordHistory();
    setState(s => {
      const layer = s.layers.find(l => l.id === id);
      if (!layer) return s;
      const copy: Layer = { ...layer, id: Math.random().toString(36).substr(2, 9), x: layer.x + 30, y: layer.y + 30 };
      return { ...s, layers: [...s.layers, copy], selectedLayerId: copy.id };
    });
  }, [recordHistory]);

  /* ─── Async image operations — refactored to use stateRef directly ─── */

  const applyCrop = useCallback((cropValues?: { l: number; t: number; r: number; b: number }) => {
    const s = stateRef.current;
    if (!s.sourceImage) return;
    recordHistory();
    const cv = cropValues ?? { l: s.cropLeft, t: s.cropTop, r: s.cropRight, b: s.cropBottom };
    const img = new Image();
    img.onload = () => {
      const x = Math.round((cv.l / 100) * img.width);
      const y = Math.round((cv.t / 100) * img.height);
      const w = Math.round(img.width * (1 - cv.l / 100 - cv.r / 100));
      const h = Math.round(img.height * (1 - cv.t / 100 - cv.b / 100));
      if (w <= 10 || h <= 10) return;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, x, y, w, h, 0, 0, w, h);
      setState(prev => ({ ...prev, sourceImage: canvas.toDataURL('image/jpeg', 0.95), imageWidth: w, imageHeight: h, cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0, tool: '' }));
    };
    img.src = s.sourceImage;
  }, [recordHistory]);

  const applyResize = useCallback((newW: number, newH: number) => {
    const s = stateRef.current;
    if (!s.sourceImage || newW <= 0 || newH <= 0) return;
    recordHistory();
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = newW; canvas.height = newH;
      canvas.getContext('2d')!.drawImage(img, 0, 0, newW, newH);
       const sx = newW / s.imageWidth;
       const sy = newH / s.imageHeight;
       setState(prev => ({
         ...prev,
         sourceImage: canvas.toDataURL('image/jpeg', 0.95),
         imageWidth: newW,
         imageHeight: newH,
         layers: prev.layers.map(layer => ({
           ...layer,
           x: Math.max(0, Math.min(newW, layer.x * sx)),
           y: Math.max(0, Math.min(newH, layer.y * sy)),
           width: Math.max(20, layer.width * sx),
           height: Math.max(20, layer.height * sy),
           ...(layer.type === 'text' && layer.fontSize
             ? { fontSize: Math.max(8, layer.fontSize * Math.min(sx, sy)) }
             : {}),
         })),
         tool: '',
       }));
    };
    img.src = s.sourceImage;
  }, [recordHistory]);

  const applyRotate = useCallback((deg: number) => {
    const s = stateRef.current;
    if (!s.sourceImage) { setState(prev => ({ ...prev, rotation: 0 })); return; }
    if (deg === 0) { setState(prev => ({ ...prev, rotation: 0, tool: '' })); return; }
    recordHistory();
    const img = new Image();
    img.onload = () => {
      const rad = (deg * Math.PI) / 180;
      const isOdd90 = Math.abs(deg) === 90 || Math.abs(deg) === 270;
      const outW = isOdd90 ? img.height : img.width;
      const outH = isOdd90 ? img.width : img.height;
      const canvas = document.createElement('canvas');
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      setState(prev => ({ ...prev, sourceImage: canvas.toDataURL('image/jpeg', 0.95), imageWidth: outW, imageHeight: outH, rotation: 0, tool: '' }));
    };
    img.src = s.sourceImage;
  }, [recordHistory]);

  const applyFlip = useCallback((axis: 'h' | 'v') => {
    const s = stateRef.current;
    if (!s.sourceImage) return;
    recordHistory();
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(axis === 'h' ? img.width : 0, axis === 'v' ? img.height : 0);
      ctx.scale(axis === 'h' ? -1 : 1, axis === 'v' ? -1 : 1);
      ctx.drawImage(img, 0, 0);
      setState(prev => ({ ...prev, sourceImage: canvas.toDataURL('image/jpeg', 0.95) }));
    };
    img.src = s.sourceImage;
  }, [recordHistory]);

  const applyBlur = useCallback((amount: number) => {
    const s = stateRef.current;
    if (!s.sourceImage) return;
    recordHistory();
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = `blur(${amount}px)`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
      setState(prev => ({ ...prev, sourceImage: canvas.toDataURL('image/jpeg', 0.95), tool: '' }));
    };
    img.src = s.sourceImage;
  }, [recordHistory]);

  const applyFrame = useCallback((borderWidth: number, color: string) => {
    const s = stateRef.current;
    if (!s.sourceImage) return;
    recordHistory();
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = img.width + borderWidth * 2;
      const h = img.height + borderWidth * 2;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, borderWidth, borderWidth);
      setState(prev => ({ ...prev, sourceImage: canvas.toDataURL('image/jpeg', 0.95), imageWidth: w, imageHeight: h, tool: '' }));
    };
    img.src = s.sourceImage;
  }, [recordHistory]);

  /**
   * Enter Saved Style creation mode: forces studio mode, opens a blank canvas.
   * The blank canvas itself is never saved — only the layer objects are persisted.
   */
  const enterStyleMode = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;
    // Warm off-white placeholder so tool placements are visible
    ctx.fillStyle = '#f5efe8';
    ctx.fillRect(0, 0, 1080, 1080);
    // Subtle grid hint
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 1080; i += 120) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1080); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1080, i); ctx.stroke();
    }
    // Centre label
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.font = 'bold 28px Vazirmatn, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('بوم خالی — ابزارهای خود را اضافه کنید', 540, 540);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    const img = new Image();
    img.onload = () => {
      pastRef.current = [];
      futureRef.current = [];
      setHistorySize({ past: 0, future: 0 });
      setState(() => ({
        ...defaultState,
        sourceImage: dataUrl,
        imageWidth: img.width,
        imageHeight: img.height,
        mode: 'studio',
        styleMode: true,
      }));
    };
    img.src = dataUrl;
  }, []);

  const exitStyleMode = useCallback(() => {
    setState(s => ({ ...s, styleMode: false, styleLimitWarning: null, sourceImage: null }));
  }, []);

  const clearStyleLimitWarning = useCallback(() => {
    setState(s => ({ ...s, styleLimitWarning: null }));
  }, []);

  const exportCanvas = useCallback(() => {
    const canvas = document.getElementById('eitashot-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = 'eitashot.jpg';
    a.href = canvas.toDataURL('image/jpeg', 0.93);
    a.click();
  }, []);

  return (
    <EditorContext.Provider value={{
      state, setState, setMode, setTool, updateAdjustment, resetAdjustments, setFilter,
      addLayer, updateLayer, deleteLayer, selectLayer, reorderLayer, duplicateLayer,
      applyCrop, applyResize, applyRotate, applyFlip, applyBlur, applyFrame,
      loadImage, exportCanvas,
      undo, redo, canUndo, canRedo,
      enterStyleMode, exitStyleMode, clearStyleLimitWarning,
    }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}
