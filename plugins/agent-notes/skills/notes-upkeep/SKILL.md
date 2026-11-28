---
name: notes-upkeep
description: Use when writing, moving, splitting or pruning a repository's agent notes (AGENTS.md or CLAUDE.md), when an agent has learned something about the code that the next agent will need, when a root instructions file has grown too long to read every session, or when setting up notes beside the code in a new repository. Triggers on "AGENTS.md", "CLAUDE.md", "agent notes", "update the notes", "split the instructions file", "LLM wiki", "context for agents", "write this down for next time".
---

# Notes upkeep

A repository's agent notes are a wiki kept beside the code. Each folder that needs one has an `AGENTS.md` saying what an agent must know before changing that folder. A short root file holds what is true everywhere and a map of the rest. An agent reads a note when it works in that folder, and writes back what it learned.

The aim is that an agent always has the rules for the code in front of it, and never pays for the rules of code it is not touching.

## The structure

- **Root `AGENTS.md`**: the commands, the rules that hold everywhere, the conventions, and a map with one line per folder that has a note. Every session reads it, so keep it short (about 2,500 words at most).
- **A note per folder**: `AGENTS.md` beside the code it is about. In a package, what the package is and its rules. In a folder of components, each component, what it is for, and the rules that name it.
- **A `CLAUDE.md` beside each note** holding the single line `@AGENTS.md`. Claude Code then loads the note when a file in that folder is read, written or edited. Other agents read `AGENTS.md` directly.
- **Every note is linked** from the note above it or from the root, so any agent can find it by following links.

## Before changing code

The notes that cover a file are the `AGENTS.md` of its folder and of every folder above it. They must be in your context before you change the file. If one already is, do not read it again. After your context has been compacted or cleared it is gone, so read it again then. Searching a folder loads nothing. Before using something from another folder, read that folder's note too.

## Where a fact goes

Ask these in order and stop at the first yes.

1. **Can the code enforce it?** A type, a test, a lint rule or a check script beats a sentence. Write the check, and keep at most one line in the note saying it exists.
2. **Is it true of one folder only?** It goes in that folder's note.
3. **Does it span several folders that share a parent?** It goes in the parent's note. If one folder owns the rule and others use it, put it with the owner and add a pointer from the parent ("when filtering every view on a page, the rule is in `src/filter`").
4. **Is it true everywhere?** It goes in the root. Expect this to be rare.
5. **Is it what happened, not what to do?** A status, a history or a decision record is not a rule. It goes in a status or changelog file that the root links to, not in a note.

If it is none of these (a one-off, a preference of this task, something the code already says plainly), do not write it down.

## Writing an entry

- Say the rule, then why. "Totals are separate grouped queries, because averages cannot be added up from cells" survives a case the rule did not foresee. A bare rule does not.
- Name the real things: the function, the prop, the file. A reader should be able to search for them.
- Say what has and has not been run or verified. "Tested against a stand-in, not a real store" is worth more than silence.
- One fact, one place. If it is needed in two notes, write it in one and point to it from the other.
- When a new entry contradicts an old one, replace the old one. A note that argues with itself is worse than none.

## Splitting and pruning

- **Split** a note when it passes the limit (about 4,000 words) or when most readers need only part of it. Split along folders that exist, move lines without rewording them, and leave a link behind.
- **Prune** when you touch a note: delete what the code now enforces, what describes code that is gone, and what restates the code. Check each caution still has its reason.
- **Never** let the root grow back. If you are about to add to it, ask question 2 again.

## Setting it up in a repository

1. Read the existing instructions file end to end. Sort each paragraph by the questions above.
2. Move each one, verbatim, to the note of the folder it is about. Change only relative link paths. Check afterwards that every original line landed exactly once.
3. Rewrite the root as: what the repository is, the map, the commands, the rules that hold everywhere, the conventions.
4. Add a `CLAUDE.md` with `@AGENTS.md` beside each note.
5. Add the check to CI. `scripts/check-notes.mjs` beside this skill needs only Node: copy it into the repository, list the folders that must have a note in `.agent-notes.json` (`{ "require": ["packages/*"] }`), and run `node scripts/check-notes.mjs` on every pull request.
6. In Claude Code, the `agent-notes` plugin's hook refuses a write to a folder whose notes are not in context and names them. In another agent there is no hook, so the rule in "Before changing code" must be written in the root file.

## What this does not cover

A note is for agents changing the code. What an agent needs in order to use a library in another project belongs in that library's published docs, catalog or skills, not in these notes.
