---
"@surfaces-ui/components": minor
---

`chartAdvice` flags three more shapes, so a Chart says so with no model: bars over more than 24 time points or numbers in order (`bars-over-time`: a line reads the trend; a histogram's bins are left alone), a pie over ordered values (`pie-in-order`), and a legend asked for one series (`one-series-legend`). `ChartShape` gains `binned` and `legend`, and `drawnShape` takes `legend` and `histogram`.
