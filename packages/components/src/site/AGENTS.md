# `packages/components/src/site`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `Hero` / `Section` / `FeatureGrid` / `DeviceFrame` / `PromptReveal` / `Showcase` / `Footer` / `Media` / `Quote` / `Callout` / `PostCard` / `PostList` | Pages people read (`site/Site.tsx`): a page's opening, its sections, cards, a product on a desktop and a phone, a prompt typed out and its answer (with Pause; finished under reduced motion; the answer keeps its place while hidden), named examples, a footer, an image or video at a fixed ratio, a pull quote, a note set apart, posts. Styles are `sf-site-*`, moved from the playground's home page; each part answers to its container. Drawn by the site catalog | `Hero`: `title`, `lead`, `eyebrow`, `actions`, `media`; `DeviceFrame`: `devices`, `title`, `label`, `children` (a node or a function of the device); `PromptReveal`: `prompt`, `loop`; `Showcase`: `items`, `value`, `onChange`; `Media`: `src`, `alt`, `kind`, `ratio` |
