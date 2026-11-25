# Styling

Most apps need only a theme. When that is not enough, there are three more ways in, each a step further from what the library checks for you. Use the first one that does the job.

| What you want | Use | Checked for contrast |
|---|---|---|
| Your brand's colours, corners, font style and density, in light and dark | A theme | Yes |
| A different look in one part of the page | A scoped theme | Yes |
| One value the theme does not cover (a company font, a wider gutter) | A `--sf-*` variable on your own element | No |
| Room, placement or a border around one component | `className` | No |

The theme, the `--sf-*` variable names and `className` are the supported ways to restyle, and changing any of them is a breaking change. The `.sf-*` class names inside the components are not: they can change in any release. Do not write rules against them.

## A theme

A theme is a plain JSON document: a name, a palette for light and one for dark (background, surface, text, muted text, accent, text on the accent), a corner radius, a font style, a density, chart colours and code colours. Every other colour (the levels of background, label and fill, borders, focus, glass) is worked out from the palette and moved until it meets WCAG 2.2 AA contrast, so a theme you write cannot come out unreadable.

```tsx
import { ThemeProvider } from "@surfaces-ui/components";
import { presetByName } from "@surfaces-ui/tokens";
import "@surfaces-ui/components/styles.css";

<ThemeProvider initialTheme={presetByName("Harbor")} initialMode="system">
  <App />
</ThemeProvider>;
```

- **Start from a preset.** There are eight: Ink (the default), Aurora, Sand, Berry, Harbor, Moss, Mono and High contrast. Copy one and change the accent before writing a palette from scratch.
- **Let people choose.** `ThemePicker` gives a person the presets, the accent, radius, font, density and mode, and `ThemeProvider` remembers their choice.
- **Charts keep their own colours.** `charts.light` and `charts.dark` hold the series colours (a tested set, in an order that keeps neighbours apart for colour-blind readers), one hue for magnitude and two poles for above and below. Data is drawn in these, never in the accent, so a brand colour does not make one series look special.
- **Your own named themes.** Give `ThemeProvider` your brand's themes (`themes={[acme]}`, each through `parseTheme` first) and they are chosen by name like the presets: a page's `theme` (`{ "preset": "Acme" }`), an agent's surface, and `ThemePicker`, which lists them after the built-in ones. A provider inside another keeps the outer one's. A built-in name always means the built-in theme. Outside React, pass the same list as `applyThemeRequest(request, current, { themes })` and `editPage(page, edits, catalog, { themes })`. The `ThemeSwitch` catalog component still takes the built-in names only, as its catalog entry lists them.
- **Themes from elsewhere are checked.** A theme from storage, a URL or an agent goes through `parseTheme(input, fallback)`, and an agent's request (`applyThemeRequest`) can change only what makes sense: a preset, the mode, the accent, radius, font, density and chart order.
- **More contrast.** `contrast: "more"` draws the theme as the system's increased-contrast setting would, whatever the person's own setting.

## A scoped theme

`scope="scoped"` themes one region instead of the whole page, so a panel can be dark on a light page, or an embed can follow a host:

```tsx
<ThemeProvider scope="scoped" initialTheme={presetByName("Aurora")} initialMode="dark">
  <AnalyticsPanel />
</ThemeProvider>
```

## A variable on your own element

Every size, colour, font and timing the components use is a `--sf-*` CSS variable. A variable set on an element of yours applies to every component inside it, and beats the theme there because it is closer:

```css
.reports {
  --sf-font: "Acme Sans", system-ui, sans-serif;   /* a font the theme's four choices do not cover */
  --sf-space-4: 1.25rem;
}
```

- Set variables on your own wrapper, not on `:root`: the theme writes its own values on `:root`, and which one wins there depends on load order.
- Colours set this way skip the contrast checks a theme gets. Change colours through the theme where you can.
- The variables are listed in `themeCss` from `@surfaces-ui/tokens`, by group: `--sf-color-*` (the levels of background, label, fill and gray, accent, borders, focus and status), `--sf-series-*`, `--sf-sequential-*` and `--sf-diverging-*` (charts), `--sf-code-*`, `--sf-font*` and `--sf-line-height*`, `--sf-space-*`, `--sf-radius*`, `--sf-control-size` and `--sf-target-min`, `--sf-duration*` and `--sf-ease*`, and `--sf-glass-*`.
- A folded `SideNav` keeps a slim strip for its menu button where the navigation was, so you reserve no room for it. Its drawer opens over the window, or over the surface it is drawn in when it is inside one.

## `className`

Most components take `className`, added to their outermost element. Use it for what is outside the component: its margin, its place in your grid, a width, a border around it. Do not use it to reach inside a component, since the elements and classes in there are not part of the API.

## Which stylesheet

There are two, with the same rules in each. Import one.

```ts
import "@surfaces-ui/components/styles.css";        // or
import "@surfaces-ui/components/styles.layer.css";  // the same, inside @layer surfaces
```

- **`styles.css`** is the default. Its class selectors beat element selectors, so a page's own resets and global rules (`button { … }`, `a { color: inherit }`) cannot undo the components. To override one of its rules you need a selector at least as specific, loaded after it.
- **`styles.layer.css`** puts every rule inside `@layer surfaces`. Anything your app writes outside a layer wins over it with no specificity to match, and that includes global resets, so use it only when your own CSS is written to live beside a library.

With Tailwind or another tool that uses layers, name the order once, before the imports, so your utilities win and the library still wins over the reset:

```css
@layer theme, base, surfaces, components, utilities;
@import "tailwindcss";
@import "@surfaces-ui/components/styles.layer.css";
```

A layer that is named nowhere comes after the ones that are, and later layers win, so without that line the library would beat your utilities.

## What not to do

- Hard-coded colours or sizes. Use a theme or a variable, so light, dark, density and high contrast keep working.
- Rules against `.sf-*` classes or the structure inside a component. They are not stable.
- Turning off focus outlines, or shrinking controls below `--sf-target-min`. Both are part of meeting WCAG 2.2 AA; see [accessibility.md](accessibility.md).
