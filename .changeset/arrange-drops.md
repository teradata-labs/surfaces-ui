---
"@surfaces-ui/spec": patch
"@surfaces-ui/components": patch
---

Arranging by hand, as people found it in an editor:

- A move keeps a Row's `sizes` and `widths` with their children, in the Row and into another, instead of leaving a Fixed or Hug width on whatever lands in its place, or a list of the wrong length that is then ignored.
- Starting a drag no longer moves the page: the strip for dropping at a container's end is drawn over its foot (`data-overlay`), and takes room only in an empty container. Only the innermost container under the pointer shows its strip.
- Beside needs the pointer to rest at a stacked element's edge (`BESIDE_HOLD`, 350 ms), and the edge is the outer tenth (48 px at most, `BESIDE_EDGE`) rather than the outer fifth (96 px). A bar is held at its left end, so dragging straight up or down ran along that edge and made a side-by-side grid by accident.
- A Row or Grid that has stacked (a narrow container) drops above and below, with a level line, as it is drawn (`drawnAcross`).
- Dropping over the middle of a Card puts the component into the list the card holds (`receiverOf`); near its top or bottom, above or below it.
- A drop where the component already is says "It is already there."
- After a bar's arrow moves a component, focus goes back to the same arrow, so pressing Enter again moves it again instead of back.
- A Row whose children are sized (`sizes`) offers no width handle, which would have replaced the sizes with equal shares.
- The id in "Drop at the end of …" is in a `<code>`, as on the bar, so a host can hide it.
