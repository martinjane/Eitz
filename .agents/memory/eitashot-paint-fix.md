---
name: Eitashot paint layer fix
description: Paint strokes live on a separate offscreen canvas to prevent filter compounding when baked back to sourceImage.
---

## Rule
The EditorCanvas maintains a `paintCanvasRef` (offscreen HTMLCanvasElement, same pixel dimensions as sourceImage). Strokes go there during drawing; the rAF loop composites it on top of all layers without filters. On pointerUp, the paint canvas is exported as a transparent PNG and added via `addLayer({ type:"image", ... })`, then cleared.

**Why:** The original code drew strokes directly on the display canvas and baked `canvas.toDataURL()` into `sourceImage` on every stroke end. This captured the already-filtered base image + all layers + the stroke — so filters compounded on each stroke and layer contents were embedded into the source.

**How to apply:** Never draw paint strokes on the main display canvas. Never call `setState({ sourceImage: canvas.toDataURL() })` from paint pointerUp — always use `addLayer` with the paint canvas PNG.
