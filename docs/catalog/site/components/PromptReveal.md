# PromptReveal

A prompt typed out, then its answer shown, and again: for showing what an agent does. It has a Pause button, stops once a person reaches into the answer, and shows the answer finished to anyone who asks for less motion.

## Props

- `prompt`: string | binding | call
- `child`: string — The answer: often a DeviceFrame.
- `loop` (optional): boolean — Starts again after a pause. Defaults to true.
- `label` (optional): string — What the answer is, for the status line.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.PromptReveal prompt="Build me a dashboard of this quarter's revenue.">
  {/* devices is not in the surface */}
</Ui.PromptReveal>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "demo",
  "component": "PromptReveal",
  "prompt": "Build me a dashboard of this quarter's revenue.",
  "child": "devices"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "demo",
  "elements": {
    "demo": {
      "type": "PromptReveal",
      "props": {
        "prompt": "Build me a dashboard of this quarter's revenue."
      },
      "children": [
        "devices"
      ]
    }
  }
}
```
