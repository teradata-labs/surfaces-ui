---
"@surfaces-ui/components": patch
"@surfaces-ui/chat": patch
---

Conversations on a phone. A `Workspace` panel can be marked `fill` for content that scrolls inside itself; stacked in a narrow container it is given about a screenful instead of its content's height, and `AnalyticsChat` marks its conversation so. The analytics conversation no longer draws its suggestions and composer over the thread when space is short, suggestions are one row that scrolls sideways in a narrow place, and the composer's Send is a touch target rather than 1.34 of one, so its tools stay on one row on a phone.
