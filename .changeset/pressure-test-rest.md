---
"@surfaces-ui/tokens": minor
"@surfaces-ui/components": minor
"@surfaces-ui/spec": minor
"@surfaces-ui/data": minor
"@surfaces-ui/proto": minor
---

The rest of three issues from the Surfaces Studio pressure tests.

- Series colours can be told apart with red-green colour blindness: any two of an order's first five now differ for those readers too, because the series hues no longer share one lightness (on light surfaces red is a crimson and green a forest green, pink and magenta are deeper; on dark surfaces green and teal are brighter). `HUES` holds the new steps and `RETIRED_HUES` the old; a saved theme using a named order is moved to them when read (`currentSeries`, `currentHue`). `checkSeries` warns about two of the first five that only colour blindness brings together.
- A `Button` waits for loose inputs it names in `requires`: while one is missing or wrong it is marked unavailable, and a press sends nothing, says what is wrong beside each and moves to the first (`useInputCheck`, `useRequiredInputs` for your own renderers).
- A `Form` field takes `visibleWhen: { field, equals }` (or `in`): it is asked for only while another field holds that value, and is not required and stored as null otherwise. `FormField.visible_when` in the contract, `fieldAsked` in `@surfaces-ui/data`, checked the same way by `checkSubmission`.
- A folded `SideNav` keeps a slim strip for its menu button instead of floating over the page, so nothing needs to step aside for it (`--sf-sidenav-inset` is gone). Its drawer opens over the surface it is drawn in, not the window, when it is inside one, and it folds for a narrow surface as it does for a narrow window.
