---
"@surfaces-ui/components": patch
"@surfaces-ui/chat": patch
---

`SideNav`: a folded navigation drawn inside a `.sf-container` opens its drawer over that region again. Where the region, or something around it, is the containing block of the fixed drawer (layout containment, a transform, a filter; in some browsers a container query alone), the region's place in the window was being added twice: the drawer sat below and to the right of a region that did not start at the window's top left. The drawer is now placed from whatever its stage is really placed against (`stageBox`), the window or its holder, and still takes the whole window when too little of the region shows.

`ChatComposer`: `data-rich` is set when `attachFiles` is given. It was handed the callback itself, which React refused with a warning on every render, leaving the attribute off.
