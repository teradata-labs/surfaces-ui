// The agent notes are a wiki kept beside the code: an AGENTS.md in every package, app and component folder,
// with a CLAUDE.md that imports it, all reachable from the root AGENTS.md. This fails when one is missing,
// unlisted, too long to be read whole, or links somewhere that is not there.
import fs from "node:fs";
import path from "node:path";

const ROOT_LIMIT = 2500; // words: the root file is read by every session
const NOTE_LIMIT = 4000; // words: a note is read whenever its folder is worked in
const problems = [];
const dirs = (parent) =>
  fs
    .readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.posix.join(parent, entry.name));
const words = (file) => fs.readFileSync(file, "utf8").split(/\s+/).filter(Boolean).length;

const top = [...dirs("packages"), ...dirs("apps"), ...dirs("plugins"), "proto", "fixtures/lake"];
const components = dirs("packages/components/src");
const root = fs.readFileSync("AGENTS.md", "utf8");
const index = fs.readFileSync("packages/components/AGENTS.md", "utf8");

for (const dir of [...top, ...components]) {
  const note = path.posix.join(dir, "AGENTS.md");
  if (!fs.existsSync(note)) {
    problems.push(`${dir}: no AGENTS.md. Add one with what an agent must know before changing this folder.`);
    continue;
  }
  const loader = path.posix.join(dir, "CLAUDE.md");
  if (!fs.existsSync(loader) || fs.readFileSync(loader, "utf8").trim() !== "@AGENTS.md")
    problems.push(`${dir}: CLAUDE.md must hold the one line "@AGENTS.md", so Claude Code loads the note.`);
  if (words(note) > NOTE_LIMIT) problems.push(`${note}: ${words(note)} words, over ${NOTE_LIMIT}. Split it by subfolder.`);
}
for (const dir of top) if (!root.includes(`(${dir}/AGENTS.md)`)) problems.push(`AGENTS.md: ${dir} is not listed under "Where things are".`);
for (const dir of components) {
  const link = `(${path.posix.relative("packages/components", dir)}/AGENTS.md)`;
  if (!index.includes(link)) problems.push(`packages/components/AGENTS.md: ${dir} is not in "Components, by folder".`);
}
if (words("AGENTS.md") > ROOT_LIMIT)
  problems.push(`AGENTS.md: ${words("AGENTS.md")} words, over ${ROOT_LIMIT}. Move what is about one folder into that folder's note.`);

const notes = ["AGENTS.md", "docs/status.md", ...[...top, ...components].map((dir) => path.posix.join(dir, "AGENTS.md"))];
for (const note of notes.filter((file) => fs.existsSync(file))) {
  for (const [, target] of fs.readFileSync(note, "utf8").matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
    if (/^[a-z]+:/.test(target)) continue;
    if (!fs.existsSync(path.join(path.dirname(note), target))) problems.push(`${note}: link to ${target}, which is not there.`);
  }
}

if (problems.length > 0) {
  console.error(`Agent notes: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n` + problems.map((line) => `  - ${line}`).join("\n"));
  process.exit(1);
}
console.log(`Agent notes are in place: ${notes.length} files, root ${words("AGENTS.md")} words.`);
