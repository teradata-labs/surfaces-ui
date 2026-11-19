# SurfacesDevTools

`import { SurfacesDevTools } from "@surfaces-ui/devtools";`

Developer tools for agent-generated UI. Placed once around an app, it records what the library does inside it with no other wiring: every message in (with its upgrade and what the catalog said), every component drawn, problems, state, events sent out, agent turns and service calls. A small button, and Ctrl+Shift+D, open a panel docked to the bottom or the side, resizable, which can move to a window of its own: a timeline, the raw messages, the component tree, state, events, services, and a scrubber that draws any surface as it stood at an earlier step. On in a development build and absent in production unless `enabled` says otherwise. A trace never holds row values or credentials, and the panel never calls a model.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `enabled` | boolean |  | Whether the tools are there at all. Left out: on in a development build, absent in production. Off, the component renders its children and nothing else. |
| `limit` | integer |  | The most events kept; the oldest are let go first. |
| `defaultOpen` | boolean |  | Open to begin with. |
| `defaultDock` | "bottom" \| "right" |  | Which edge the panel docks to to begin with. On a narrow screen it is always the bottom. |
| `shortcut` | boolean |  | Whether Ctrl+Shift+D (⌘⇧D on a Mac) opens and closes the tools. |
| `anchor` | "window" \| "inline" |  | "window" floats the button over the page's corner and docks the panel to the window; "inline" keeps both where the component is placed. |
| `performanceTracks` | boolean |  | Also show spans as custom tracks in the Performance panel of Chrome's developer tools. |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `children` (required): **The app.** Everything inside is traced while the tools are on.
- `recorder`: **Your own recorder.** A recorder from `createRecorder` in @surfaces-ui/trace, to read what is recorded from elsewhere.
- `catalog`: **Your own catalog.** The catalog recorded surfaces are drawn with when shown again, with `renderers`. Defaults to the analytics catalog.

## Callbacks

- `onOpenChange`: The tools were opened or closed.

## Example

```tsx
<SurfacesDevTools
  enabled
  defaultOpen
  anchor="inline"
  defaultDock="bottom"
  children={children}
  onOpenChange={…}
/>
```
