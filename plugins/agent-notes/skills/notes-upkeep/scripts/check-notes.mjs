#!/usr/bin/env node
// Checks a repository's agent notes: an AGENTS.md beside the code in each folder that needs one, each with a
// CLAUDE.md that imports it, all reachable from the root file by links, none too long to be read whole, and no
// link to something that is not there. Run it from the repository root, in CI:
//   node check-notes.mjs
// Settings are optional, in .agent-notes.json at the root:
//   { "require": ["packages/*", "docs"],   folders that must have a note ("/*" means each folder inside)
//     "also": ["docs/status.md"],          other files whose links are checked
//     "loader": true,                      each note needs a CLAUDE.md holding "@AGENTS.md" (false to turn off)
//     "rootLimit": 2500, "noteLimit": 4000, words
//     "ignore": ["vendor"] }               folders not searched for notes
// It reads files and prints; it changes nothing and sends nothing anywhere.
import fs from "node:fs";
import path from "node:path";

const NOTE = "AGENTS.md";
const SKIP = new Set(["node_modules", "dist", "build", "out", "coverage", "target", "vendor"]);
const settings = fs.existsSync(".agent-notes.json") ? JSON.parse(fs.readFileSync(".agent-notes.json", "utf8")) : {};
const ignore = new Set(settings.ignore ?? []);
const problems = [];
const posix = (file) => file.split(path.sep).join("/");
const words = (file) => fs.readFileSync(file, "utf8").split(/\s+/).filter(Boolean).length;
const folders = (parent) =>
  fs.existsSync(parent)
    ? fs.readdirSync(parent, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => posix(path.join(parent, entry.name)))
    : [];

function notesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = posix(path.join(dir, entry.name));
    if (entry.isDirectory()) return entry.name.startsWith(".") || SKIP.has(entry.name) || ignore.has(full) ? [] : notesUnder(full);
    return entry.name === NOTE ? [full] : [];
  });
}

const root = fs.existsSync(NOTE) ? NOTE : fs.existsSync("CLAUDE.md") ? "CLAUDE.md" : undefined;
if (!root) {
  console.error("Agent notes: no AGENTS.md (or CLAUDE.md) at the root. Run this from the repository root.");
  process.exit(1);
}
const notes = notesUnder(".").filter((note) => note !== root);
const have = new Set(notes.map((note) => path.posix.dirname(note)));

for (const pattern of settings.require ?? []) {
  for (const dir of pattern.endsWith("/*") ? folders(pattern.slice(0, -2)) : [pattern]) {
    if (!have.has(dir)) problems.push(`${dir}: no ${NOTE}. Add one with what an agent must know before changing this folder.`);
  }
}
for (const note of notes) {
  const dir = path.posix.dirname(note);
  if (settings.loader !== false) {
    const loader = path.posix.join(dir, "CLAUDE.md");
    if (!fs.existsSync(loader) || fs.readFileSync(loader, "utf8").trim() !== `@${NOTE}`)
      problems.push(`${dir}: CLAUDE.md must hold the one line "@${NOTE}", so Claude Code loads the note.`);
  }
  const limit = settings.noteLimit ?? 4000;
  if (words(note) > limit) problems.push(`${note}: ${words(note)} words, over ${limit}. Split it by subfolder.`);
}
const rootLimit = settings.rootLimit ?? 2500;
if (words(root) > rootLimit) problems.push(`${root}: ${words(root)} words, over ${rootLimit}. Move what is about one folder into that folder's note.`);

// Every link must lead somewhere, and every note must be reachable from the root by following links between notes.
const links = (file) =>
  [...fs.readFileSync(file, "utf8").matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)]
    .map((match) => match[1])
    .filter((target) => !/^[a-z]+:/i.test(target))
    .map((target) => posix(path.normalize(path.join(path.dirname(file), target))));
const reached = new Set([root]);
const queue = [root];
while (queue.length > 0) {
  for (const target of links(queue.pop())) {
    if (path.posix.basename(target) === NOTE && fs.existsSync(target) && !reached.has(target)) {
      reached.add(target);
      queue.push(target);
    }
  }
}
for (const file of [root, ...notes, ...(settings.also ?? []).filter((extra) => fs.existsSync(extra))]) {
  for (const target of links(file)) if (!fs.existsSync(target)) problems.push(`${file}: link to ${target}, which is not there.`);
}
for (const note of notes) if (!reached.has(note)) problems.push(`${note}: nothing links to it. List it in the note of the folder above, or in ${root}.`);

if (problems.length > 0) {
  console.error(`Agent notes: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n` + problems.map((line) => `  - ${line}`).join("\n"));
  process.exit(1);
}
console.log(`Agent notes are in place: ${notes.length} notes under ${root} (${words(root)} words).`);
