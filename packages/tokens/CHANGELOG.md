# @surfaces-ui/tokens

## 0.4.0

No changes in this release.

## 0.3.0

### Minor Changes

- 1999320: A host can add its own named themes beside the built-in presets: `ThemeProvider` takes `themes`, and a page's `theme`, an agent surface's `surfaces_theme` and `ThemePicker` choose them by name. `applyThemeRequest`, `editPage` and `presetByName` take the same list as an option. A built-in name always means the built-in preset.

## 0.2.0

### Minor Changes

- caab7c1: Fixes and catalog additions from the Surfaces Studio pressure tests.
  
  - `extractSurfaces` reads an A2UI message written over several lines, and a list of messages; a block holding text that is not a message ends in one `error` event (`UNREAD_SURFACE`) instead of losing the change in silence.
  - The catalog prompt writes every prop's shape (`array of { column: string, desc?: boolean }`; `shapeText`), lists each function's arguments, and shows both forms of a control's `action`. A value that fits no form of a union is refused with the problems of the closest form, never a bare "Invalid input".
  - `formatString` takes `${path|words}` for a value that is not there yet.
  - New catalog components: `RowList` (one component drawn per row of a query, with the row's key in a Button's event; `RowList` in `@surfaces-ui/components`) and `Message` (one turn of a conversation).
  - Every catalog component takes `visibleWhen: { path, equals }` (or `in`). `TextField`, `NumberField`, `ChoicePicker`, `CheckBox` and `DateTimeInput` take `required` (`TextField` also `pattern`) and say what is wrong beside the field once it has been left.
  - Charts: a row with no x is left off a time or number axis and no longer sizes the y axis, and the chart says so; axis titles are placed from their tick labels and no longer clipped.
  - Series colours: every named order is rearranged so any two of its first five colours can be told apart, not only neighbours (blue and indigo no longer both lead). `checkSeries` reports such pairs. A saved theme holding an earlier order is moved to the current one when read.
  - `SideNav`: the menu button of a folded navigation sits in its own container (sticky), not fixed to the window, and tells what follows it the room to leave (`--sf-sidenav-inset`); its accessible name no longer says "navigation" twice.
  - `KeyValue` rows are no wider than 36rem, so a label and its value stay a pair on a wide page.
  - Seeds: a seed number above 22018 no longer overflows a 32-bit integer in DuckDB.
- 7343db7: The rest of three issues from the Surfaces Studio pressure tests.
  
  - Series colours can be told apart with red-green colour blindness: any two of an order's first five now differ for those readers too, because the series hues no longer share one lightness (on light surfaces red is a crimson and green a forest green, pink and magenta are deeper; on dark surfaces green and teal are brighter). `HUES` holds the new steps and `RETIRED_HUES` the old; a saved theme using a named order is moved to them when read (`currentSeries`, `currentHue`). `checkSeries` warns about two of the first five that only colour blindness brings together.
  - A `Button` waits for loose inputs it names in `requires`: while one is missing or wrong it is marked unavailable, and a press sends nothing, says what is wrong beside each and moves to the first (`useInputCheck`, `useRequiredInputs` for your own renderers).
  - A `Form` field takes `visibleWhen: { field, equals }` (or `in`): it is asked for only while another field holds that value, and is not required and stored as null otherwise. `FormField.visible_when` in the contract, `fieldAsked` in `@surfaces-ui/data`, checked the same way by `checkSubmission`.
  - A folded `SideNav` keeps a slim strip for its menu button instead of floating over the page, so nothing needs to step aside for it (`--sf-sidenav-inset` is gone). Its drawer opens over the surface it is drawn in, not the window, when it is inside one, and it folds for a narrow surface as it does for a narrow window.

## 0.1.0

### Minor Changes

- 582569d: Berry is now a deep pink-purple on plum-tinted greys, which turn warm, toward wine, in dark mode. Its charts open with a new magenta hue (`HUES.magenta`, between pink and purple) and follow a new order found the same way as the others. A theme saved from the old Berry keeps its colours. A new preset, Harbor, has cool slate greys, a clear blue accent and the Classic chart order.
- 582569d: Density now changes the controls: a new token, `--sf-control-size` (32px comfortable, 24px compact), sizes every button, field, segment and icon button, never under the target minimum (44px on a touch screen). Icon buttons draw their icon with `ControlIcon` (a new `close` icon) instead of ×, ✎, ↑ and ↓ characters, centred at any size. On a touch screen a tile's controls sit in one row with no box left behind after a tap.
  
  `SideNav` folded away no longer keeps a strip beside the page: a menu button floats at the top left, and the navigation slides in from the left as a modal dialog: a drawer over a dimmed page on a wide screen, the whole screen under 40rem (focus inside, closed by Escape, its close button, a press outside or choosing a page). It no longer opens on hover. Under 40rem it is always folded and offers no pin (`SIDENAV_NARROW`).
- 582569d: Gummy motion. New tokens `--sf-ease-gummy` (a damped spring) and `--sf-duration-springy`, zero under reduced motion. A press springs back when let go, the segmented thumb slides with the spring and squishes where it lands, and a control that switches on or off squishes once after a pointer or a finger changed it. The NavBar's highlight slides from page to page; tree carets turn and the rows beneath glide as a branch opens; sections open to their height; a folded workspace panel drops in when unfolded; and the chat's setup menu slides between its sections.
- 582569d: A High contrast preset, and `Theme.contrast: "more"` for any theme. With it, edges reach 3:1, tertiary labels 7:1 and quaternary 4.5:1, dividers are stronger, glass is solid, and every pane and control draws its edge through the new `--sf-color-edge` token (transparent otherwise, and turned on by `prefers-contrast: more` too). Sand's accent is now a burnt orange with some brown in it, and its charts follow a new orange-led order.
- 582569d: The MCP app page follows the host's colours as well as its light or dark mode. It reads `hostContext.styles.variables` and takes the nearest preset with the host's own accent and corner radius (`themeFromHostStyles`); a host that shares no colours leaves it on the default theme. `hostStyleVariables(theme, mode)` writes a theme as those variables for a host that embeds the page.
- 582569d: A sixth preset, Moss: greys with a trace of green and a green accent, warmer in dark mode, with its own series order (`SERIES_ORDERS.Moss`) that keeps teal, blue and indigo away from the green it starts on.
- 582569d: Five presets replace the ten: Ink (the new default), Aurora (the demo theme), Sand, Berry and Mono. A theme that names an old preset is refused by `applyThemeRequest` with the list of new names; a saved theme document still loads through `parseTheme`.
  
  Twelve new hues built in OKLCH replace the eight, with series orders Classic, Aurora, Sand, Ink and Berry, each tested for red-green colour blindness and for 3:1 on every preset's panes.
  
  Colours now come in ranges generated by the contrast each level must reach (`stepByContrast`, `mixOklab`): `--sf-color-bg-1..4`, `--sf-color-label-1..4`, `--sf-color-fill-1..4`, `--sf-color-gray-1..6`, `--sf-color-divider` and `--sf-color-accent-hover` / `-pressed`. Glass for floating controls (`--sf-glass-regular`, `-thick`, `-clear`, `-filter`, `-edge`, `-highlight`, `-shadow`, `--sf-glass-muted`) is tested against the worst thing behind it, and turns solid under reduced transparency, increased contrast and forced colours. A type scale adds `--sf-font-size-xs` and title sizes, weights and line heights.
  
  Motion is timed by tokens (`--sf-duration-fast`, `--sf-duration`, `--sf-duration-slow`, `--sf-ease`, `--sf-ease-out`, `--sf-ease-spring`, `--sf-press-scale`), all stopped under reduced motion. Components follow the new look: buttons are fills that answer a press, menus, popovers, tooltips and the side navigation's drawer are glass, cards and panels lose their outlines, and a box inside a box gives up its fill. `NavBar` is new in `@surfaces-ui/components`: sections across the top on glass, the current section's pages beneath, and a full-screen menu on a narrow screen.

### Patch Changes

- 582569d: Accessibility fixes found by axe in a real browser. Status colours and accent text now reach 4.5:1 on every surface they are drawn on, including the soft accent fill. Explorer pills and pipeline graph nodes say their visible name first, then the rest as hidden text, so "Channel (attribute, in use)" rather than a label that differs from what is shown. Tables that scroll on their own take focus and are named regions. The chat's conversation log holds articles rather than list items without a list, and stream metric sparklines sit inside their definition. A new `.sf-visually-hidden` class is pinned so hidden text never widens a page from inside a scroll box.
- 582569d: Aurora's chart colours now run teal, orange, pink, amber, purple, red, indigo, green. The sky blue that sat third read as one cool family with the teal. A theme saved with the old order is moved to the new one when it is read (`RETIRED_ORDERS`, `currentSeries`); colours a person chose are kept.
- 582569d: Ink's background and surfaces carry only a trace of blue (dark `#0C0C0F` and `#17181B`, light `#FBFBFC` and `#F0F0F2`), at the same lightness, so the indigo accent and the data are the colour on the page.
  
  Sand's greys move from sage toward a warm yellow, like paper and sand, with more colour (dark `#14120A` and `#201D10`, light `#FAF9F1` and `#F2EEDC`), at the same lightness.
- 582569d: Sand and Berry have quieter backgrounds and cards again: half the tint they had, with the same lightness and hue, so their greys sit near Ink's. A theme saved with either set of earlier greys moves to the new ones, keeping its accent.
- 582569d: Aurora, Sand, Berry, Harbor and Moss have quieter backgrounds and cards: half the tint in their card colour and 40% less in their page colour, with the same lightness and hue. A theme saved with the earlier greys moves to the new ones, keeping its accent.
