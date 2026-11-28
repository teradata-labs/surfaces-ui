# `packages/components/src/panzoom`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

## Rules

- `ModelDiagram` and `PipelineGraph` pan and zoom through `usePanZoom` (with `PanZoomControls`): drag the background or scroll to pan, Ctrl/⌘ + wheel or pinch to zoom about the pointer, buttons for zoom in, zoom out, fit and 100%, and `+` `-` `0` and arrows on the focused canvas. The view fits the content on first draw and until a person takes over; zoom is clamped (`ZOOM_MIN`, `ZOOM_MAX`). The transform maths (`zoomAt`, `fitView`, `clampPan`, `revealBox`) are plain functions; test those, not pixels. A new diagram reuses the hook, and anything on the plane a press must reach (a card) carries `data-pan-ignore`.
