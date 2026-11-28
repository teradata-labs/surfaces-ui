# `packages/components/src/menu`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `useContextMenu` | A right-click menu for anything: opens on right click, long press, the Menu key and Shift+F10 | `open(event, label, items)`, `element` |

## Rules

- **A menu is a shortcut, never the only way.** Use `useContextMenu` for right-click menus (a list of actions); settings or form controls gathered behind one button go in a `Popover`, never in a menu; every item must also be reachable by a key, a button or another control, and the menu itself must open from the keyboard (it does, through the `contextmenu` event). Keep the key table in [docs/accessibility.md](../../../../docs/accessibility.md) current when adding a shortcut.
