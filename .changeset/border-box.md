---
"@surfaces-ui/components": patch
---

Surfaces UI's own elements size with `box-sizing: border-box` (at no specificity), as the playground draws them, so a full-width part with padding (NavBar's menu items, filter chips, SideNav buttons) no longer runs past its row in an app without its own border-box reset.
