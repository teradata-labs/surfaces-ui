---
"@surfaces-ui/chat": minor
"@surfaces-ui/components": minor
---

A model in `ChatProvider.models` can carry a `level` (`{ value, of, label }`). The Model menu draws it beside the model's name as bars rising left to right, filled up to `value` in the accent colour, with the level's word ("Everyday"). The word is what a screen reader reads; the bars are hidden from it. `ModelLevelBars` draws the same anywhere.
