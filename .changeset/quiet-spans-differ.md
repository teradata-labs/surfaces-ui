---
"@surfaces-ui/spec": patch
---

`SurfaceView` no longer records two trace events with one id. A component drawn under an id that another kind of component held before (or drawn again after a frame was put around it) reused the first one's span, so the dev tools Timeline held rows with the same key and React warned about it. A scope now belongs to a component's place, id and kind, is recorded once, and is let go when the component is gone.
