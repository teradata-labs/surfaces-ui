# PostCard

One post: its title (a link with `href`, otherwise it sends `open` with its `id`), date, a line of it and its tags.

## Props

- `title`: string
- `date` (optional): string — An ISO date, 2026-11-21. Shown in the reader's words for it.
- `excerpt` (optional): string
- `tags` (optional): array of string
- `href` (optional): string — An http or https address, or a path on this site. Anything else is not drawn as a link.
- `level` (optional): 1 | 2 | 3 | 4 — The title's heading level. Defaults to 3.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **open**: When a post without a link is opened. Adds `id` (the post's id).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.PostCard
  title="Charts that tell the truth"
  date="2026-11-01"
  excerpt="Start bars at zero, and other rules worth keeping."
  tags={["design"]}
  href="https://example.com/charts"
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "post",
  "component": "PostCard",
  "title": "Charts that tell the truth",
  "date": "2026-11-01",
  "excerpt": "Start bars at zero, and other rules worth keeping.",
  "tags": [
    "design"
  ],
  "href": "https://example.com/charts"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "post",
  "elements": {
    "post": {
      "type": "PostCard",
      "props": {
        "title": "Charts that tell the truth",
        "date": "2026-11-01",
        "excerpt": "Start bars at zero, and other rules worth keeping.",
        "tags": [
          "design"
        ],
        "href": "https://example.com/charts"
      }
    }
  }
}
```
