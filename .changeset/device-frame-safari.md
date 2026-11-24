---
"@surfaces-ui/components": patch
---

`DeviceFrame`'s phone keeps its screen inside the bezel in Safari: the screen is placed by inset rather than `height: 100%`, which Safari resolved against the whole frame, padding included, so the screen ran over the rounded bottom corners. On the phone, content that scrolls up now fades out toward the island instead of being cut along a line.
