---
"@surfaces-ui/components": patch
---

A `Chart` with `xBins` over a DECIMAL column now sizes its bins from the real range. The lowest and highest values were read as plain numbers, so a DECIMAL's unscaled digits widened the range a hundredfold or more and every value fell in one bin. They are now read with `numericValue` (`rangeBinWidth`).
