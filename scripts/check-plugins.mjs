#!/usr/bin/env node
// Checks the plugins under plugins/ against what a Claude plugin directory submission is refused or held for
// (https://claude.com/docs/plugins/pre-submission-checklist), and keeps the MCP server the analytics plugin
// starts pinned to the version this repository publishes. `--write` sets that pin and raises the plugin's
// version (run by `pnpm version-packages`); without it, a difference is a failure.
import fs from "node:fs";
import path from "node:path";

const write = process.argv.includes("--write");
const problems = [];
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const RESERVED = new Set(["claude", "anthropic", "official", "plugin", "mcp", "test"]);
const TEXT = /\.(md|json|mjs|js|ts|txt|yaml|yml|sh|svg)$/;
const IMAGE = /\.(png|jpe?g|gif|webp|woff2?|ttf|otf)$/;
const LAUNCHERS = new Set(["npx", "bunx", "uvx", "pipx"]);

// The analytics plugin starts @surfaces-ui/mcp: pin it to the version being published, and version the plugin with it.
const released = json("packages/mcp/package.json").version;
const analytics = "plugins/surfaces-analytics";
{
  const file = `${analytics}/.mcp.json`;
  const mcp = json(file);
  const args = mcp.mcpServers.surfaces.args;
  const at = args.findIndex((arg) => arg.startsWith("@surfaces-ui/mcp"));
  const manifest = json(`${analytics}/.claude-plugin/plugin.json`);
  if (args[at] !== `@surfaces-ui/mcp@${released}`) {
    if (write) {
      args[at] = `@surfaces-ui/mcp@${released}`;
      // An installed plugin is updated only when its version changes, so a new pin is a new version of the plugin.
      const [major, minor] = manifest.version.split(".").map(Number);
      manifest.version = `${major}.${minor + 1}.0`;
      fs.writeFileSync(file, `${JSON.stringify(mcp, null, 2)}\n`);
      fs.writeFileSync(`${analytics}/.claude-plugin/plugin.json`, `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(`surfaces-analytics ${manifest.version} now starts @surfaces-ui/mcp@${released}.`);
    } else problems.push(`${analytics}: must start @surfaces-ui/mcp@${released}. Run node scripts/check-plugins.mjs --write.`);
  }
}

const files = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.posix.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
const frontmatter = (file) => {
  const match = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(file, "utf8"));
  return match ? Object.fromEntries(match[1].split("\n").filter((line) => /^[\w-]+:/.test(line)).map((line) => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 1).trim()])) : undefined;
};

const listed = new Map(json(".claude-plugin/marketplace.json").plugins.map((plugin) => [plugin.source, plugin.name]));
const plugins = fs.readdirSync("plugins", { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => `plugins/${entry.name}`);
for (const dir of plugins) {
  const say = (text) => problems.push(`${dir}: ${text}`);
  const manifestFile = `${dir}/.claude-plugin/plugin.json`;
  if (!fs.existsSync(manifestFile)) {
    say("no .claude-plugin/plugin.json");
    continue;
  }
  const manifest = json(manifestFile);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(manifest.name ?? "") || RESERVED.has(manifest.name)) say(`name "${manifest.name}" must be lowercase letters, digits and hyphens, up to 64, and not a reserved word`);
  if (manifest.name !== path.basename(dir)) say(`name "${manifest.name}" must match its folder`);
  for (const key of ["description", "version", "license"]) if (!manifest[key]) say(`plugin.json needs "${key}"`);
  if (!manifest.author?.name) say('plugin.json needs "author.name"');
  if (manifest.hooks) say('leave "hooks" out of plugin.json: hooks/hooks.json is loaded by itself');
  if (listed.get(`./${dir}`) !== manifest.name) say("is not listed in .claude-plugin/marketplace.json under its own name");

  const readme = `${dir}/README.md`;
  const prose = fs.existsSync(readme) ? fs.readFileSync(readme, "utf8").replace(/```[\s\S]*?```/g, "") : "";
  if (prose.split(/\s+/).filter(Boolean).length < 40) say("README.md needs at least 40 words outside code blocks");
  if (!/what it runs/i.test(prose)) say('README.md must say what the plugin runs, reads and sends (a "What it runs, reads and sends" section)');
  // Claude Code does not load an instructions file at a plugin's root, and it would be shipped to everyone who installs it.
  for (const stray of ["CLAUDE.md", "AGENTS.md", ".npmrc", "package.json"]) if (fs.existsSync(`${dir}/${stray}`)) say(`${stray} does not belong at a plugin's root`);

  const all = files(dir);
  if (all.length > 512) say(`${all.length} files, over 512`);
  for (const file of all) {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) say(`${file} is a link; commit a regular file`);
    if (!TEXT.test(file) && !IMAGE.test(file) && path.basename(file) !== "LICENSE") say(`${file} is not a text, image or font file`);
    if (!IMAGE.test(file) && stat.size > 256 * 1024) say(`${file} is over 256 KiB`);
    if (/\.DS_Store|Thumbs\.db|desktop\.ini|__MACOSX/.test(file)) say(`${file} should not be committed`);
  }

  const commands = [];
  if (fs.existsSync(`${dir}/hooks/hooks.json`)) {
    const hooks = json(`${dir}/hooks/hooks.json`);
    if (!hooks.hooks || typeof hooks.hooks !== "object") say('hooks/hooks.json needs a top-level "hooks" object');
    for (const groups of Object.values(hooks.hooks ?? {})) for (const group of groups) for (const hook of group.hooks ?? []) if (hook.command) commands.push(hook.command);
    for (const command of commands) {
      const rest = command.replaceAll("${CLAUDE_PLUGIN_ROOT}", "");
      if (/\$|`/.test(rest)) say(`a hook command may use no variable but \${CLAUDE_PLUGIN_ROOT}: ${command}`);
      if (!command.includes('"${CLAUDE_PLUGIN_ROOT}/')) say(`a hook command names its script in full from "\${CLAUDE_PLUGIN_ROOT}/", in double quotes: ${command}`);
    }
  }
  if (fs.existsSync(`${dir}/.mcp.json`)) {
    const servers = json(`${dir}/.mcp.json`).mcpServers;
    if (!servers) say('.mcp.json needs a top-level "mcpServers" object');
    for (const [name, server] of Object.entries(servers ?? {})) {
      if (server.url && !/^(https|wss):\/\//.test(server.url)) say(`MCP server ${name} must use https or wss`);
      if (LAUNCHERS.has(server.command)) {
        const packageArg = (server.args ?? []).find((arg) => !arg.startsWith("-"));
        if (!/@\d+\.\d+\.\d+$/.test(packageArg ?? "")) say(`MCP server ${name} must pin its package to an exact version (${packageArg})`);
      }
      if (server.env && /(key|token|secret|password)/i.test(JSON.stringify(server.env)) && !JSON.stringify(server.env).includes("${user_config.")) say(`MCP server ${name}: a credential comes from userConfig, never from a file`);
    }
  }
  for (const skill of fs.existsSync(`${dir}/skills`) ? fs.readdirSync(`${dir}/skills`) : []) {
    const file = `${dir}/skills/${skill}/SKILL.md`;
    if (!fs.existsSync(file)) {
      say(`skills/${skill} has no SKILL.md`);
      continue;
    }
    const front = frontmatter(file);
    if (!front) say(`${file} has no front matter`);
    else {
      if (front.name !== skill) say(`${file}: name "${front.name}" must match its folder`);
      if (!front.description) say(`${file}: needs a description`);
      // Only these keys are read outside Claude Code; any other is refused by other clients.
      for (const key of Object.keys(front)) if (!["name", "description", "license", "compatibility", "metadata", "allowed-tools"].includes(key)) say(`${file}: "${key}" is not a portable front matter key`);
      if ((front.description ?? "").length > 1024) say(`${file}: description is over 1024 characters`);
    }
  }
}

if (problems.length > 0) {
  console.error(`Plugins: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n` + problems.map((line) => `  - ${line}`).join("\n"));
  process.exit(1);
}
console.log(`Plugins are ready to submit: ${plugins.map((dir) => path.basename(dir)).join(", ")}.`);
