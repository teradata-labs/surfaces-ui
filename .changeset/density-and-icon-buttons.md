---
"@surfaces-ui/tokens": minor
"@surfaces-ui/components": patch
---

Density now changes the controls: a new token, `--sf-control-size` (32px comfortable, 24px compact), sizes every button, field, segment and icon button, never under the target minimum (44px on a touch screen). Icon buttons draw their icon with `ControlIcon` (a new `close` icon) instead of ×, ✎, ↑ and ↓ characters, centred at any size. On a touch screen a tile's controls sit in one row with no box left behind after a tap.

`SideNav` folded away no longer keeps a strip beside the page: a menu button floats at the top left, and the navigation slides in from the left as a modal dialog: a drawer over a dimmed page on a wide screen, the whole screen under 40rem (focus inside, closed by Escape, its close button, a press outside or choosing a page). It no longer opens on hover. Under 40rem it is always folded and offers no pin (`SIDENAV_NARROW`).
