# agent-notes

Keeps a repository's agent notes as a wiki beside the code, so an agent always has the rules for the code in front of it and never pays for the rules of code it is not touching.

A single instructions file grows until every session reads tens of thousands of words to change one line. This plugin holds the other shape in place: a short root `AGENTS.md` with a map, an `AGENTS.md` in each folder with what is specific to it, and a `CLAUDE.md` beside each that imports it.

## What is in it

| Part | What it does |
|---|---|
| Skill `notes-upkeep` | The method: where a fact goes, how to write an entry, when to split or prune a note, and how to move a repository from one long file to notes beside the code. |
| Hook | Before a file is written, checks that the notes covering it are in the session's context. If one is not, it refuses that one write and names the notes to read. |
| `check-notes.mjs` | A check for CI: every folder that needs a note has one, each is linked from the root, none is too long, no link is dead. |

## Install

In Claude Code:

```
/plugin marketplace add teradata-labs/surfaces-ui
/plugin install agent-notes@surfaces-ui
```

In another agent that reads Agent Skills, copy `skills/notes-upkeep` into its skills folder. The skill and the check work anywhere; the hook is for Claude Code only, so in another agent the rule "read a folder's notes before changing it" has to be written in the root `AGENTS.md`.

## Try it

- "Our CLAUDE.md is 20,000 words. Split it into notes beside the code without rewording anything."
- "I just learned that the totals in the pivot table must be separate queries. Write that down where the next agent will find it."
- "Set up the notes check in CI and tell me which folders have no note yet."

## What it runs, reads and sends

Everything runs on your machine with Node, which must be installed. Nothing is sent or fetched anywhere, and there is no telemetry.

- **The hook** (`skills/notes-upkeep/scripts/notes-guard.mjs`) runs on four events: before `Edit`, `Write` and `NotebookEdit`, after `Read`, when an instructions file is loaded, and when a session starts after a compaction or a clear. It reads the path of the file involved and looks for `AGENTS.md` files in that file's folder and the folders above it, inside the project only. It keeps the list of notes already in context in a small JSON file under the system's temporary folder (`surfaces-notes/<session>.json`), paths only, and removes it when the context is compacted or cleared. It can refuse a write; it never changes a file in your project. If it fails for any reason of its own, the write goes ahead.
- **The check** (`skills/notes-upkeep/scripts/check-notes.mjs`) reads `AGENTS.md`, `CLAUDE.md` and `.agent-notes.json` files and prints what is missing. It changes nothing.

Neither reads the contents of your code, your conversation or any credential.

## Settings

Optional, in `.agent-notes.json` at the repository root:

```json
{ "require": ["packages/*", "apps/*"], "rootLimit": 2500, "noteLimit": 4000 }
```

`require` lists folders that must have a note (`/*` means each folder inside). `loader: false` drops the need for a `CLAUDE.md` beside each note. `ignore` lists folders not to search.

## Support

Questions and problems: https://github.com/teradata-labs/surfaces-ui/issues

Apache License 2.0.
