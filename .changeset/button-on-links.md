---
"@surfaces-ui/components": patch
---

A link drawn as a button (`<a class="sf-button">`) is laid out like one. `.sf-button` set a height, which an inline `a` ignores, so its words sat at the top of the box; an `a.sf-button` is now an inline flex box with its words centred and no underline. Buttons are unchanged.
