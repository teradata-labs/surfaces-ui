#!/usr/bin/env node
// Keeps an agent from changing a folder before its notes (AGENTS.md) are in context.
//   loaded: remembers which notes this session has in context (a note the harness loaded, or one the agent read)
//   guard:  before a file is written, refuses once and names the notes not yet in context
//   reset:  forgets everything when the context is compacted or cleared, since the notes went with it
// It never stops work for any reason of its own: any error lets the call through.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const NOTE = "AGENTS.md";

/** The notes that cover a file: one per folder from the file's own up to, not including, the root. */
export function notesFor(file, root) {
  const notes = [];
  let dir = path.dirname(path.resolve(root, file));
  const top = path.resolve(root);
  while (dir.startsWith(top + path.sep)) {
    const note = path.join(dir, NOTE);
    if (fs.existsSync(note)) notes.unshift(note);
    dir = path.dirname(dir);
  }
  return notes;
}

function stateFile(input) {
  const dir = path.join(os.tmpdir(), "surfaces-notes");
  fs.mkdirSync(dir, { recursive: true });
  const who = [input.session_id ?? "session", input.agent_id].filter(Boolean).join("-").replace(/[^\w-]/g, "_");
  return path.join(dir, `${who}.json`);
}
const read = (file) => {
  try {
    return new Set(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return new Set();
  }
};

function main(mode, input) {
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const file = stateFile(input);
  if (mode === "reset") {
    const dir = path.dirname(file);
    const mine = String(input.session_id ?? "session").replace(/[^\w-]/g, "_");
    for (const name of fs.readdirSync(dir)) if (name.startsWith(mine)) fs.rmSync(path.join(dir, name), { force: true });
    return 0;
  }
  const target = input.file_path ?? input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!target) return 0;
  const absolute = path.resolve(root, target);
  if (!absolute.startsWith(path.resolve(root) + path.sep)) return 0;
  const have = read(file);
  if (mode === "loaded") {
    const name = path.basename(absolute);
    // A note itself, or the CLAUDE.md that imports it. Reading any other file makes the harness load the
    // notes of its folders (each folder's CLAUDE.md imports its note), so those count as in context too.
    const now =
      name === NOTE || name === "CLAUDE.md"
        ? [path.join(path.dirname(absolute), NOTE)]
        : input.hook_event_name === "PostToolUse"
          ? notesFor(absolute, root).filter((note) => fs.existsSync(path.join(path.dirname(note), "CLAUDE.md")))
          : [];
    const before = have.size;
    for (const note of now) have.add(note);
    if (have.size !== before) fs.writeFileSync(file, JSON.stringify([...have]));
    return 0;
  }
  if (mode === "guard") {
    const missing = notesFor(absolute, root).filter((note) => !have.has(note));
    if (missing.length === 0) return 0;
    const list = missing.map((note) => `  ${path.relative(root, note)}`).join("\n");
    process.stderr.write(
      `Read the notes for this folder before changing ${path.relative(root, absolute)}. They hold its rules and are not in your context yet:\n${list}\nRead ${missing.length === 1 ? "it" : "them"}, then make the change again.\n`,
    );
    return 2;
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let text = "";
  process.stdin.on("data", (chunk) => (text += chunk));
  process.stdin.on("end", () => {
    let code = 0;
    try {
      code = main(process.argv[2], JSON.parse(text || "{}"));
    } catch {
      code = 0;
    }
    process.exit(code);
  });
}
