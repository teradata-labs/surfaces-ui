---
"@surfaces-ui/chat": minor
"@surfaces-ui/components": minor
---

A model in `ChatProvider.models` can carry a `level` (`{ value, of, label }`). The Model menu draws it beside the model's name as bars rising left to right, filled up to `value` in the accent colour, with the level's word ("Everyday"). The word is what a screen reader reads; the bars are hidden from it. `ModelLevelBars` draws the same anywhere.

A chat menu's popover now floats fixed to the window, placed beside its button and kept inside the window, so a panel that scrolls or clips does not cut it off; a menu of models is as wide as its longest line, so each model's name and level share one line.
