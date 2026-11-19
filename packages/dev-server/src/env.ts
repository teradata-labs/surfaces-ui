import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/** The file the dev server reads secrets from, next to `surfaces.config.ts`. It must be git-ignored. */
export const ENV_FILE = ".env.local";

/**
 * Reads `.env.local` in `dir` into `env`, so a key such as
 * `ANTHROPIC_API_KEY` can live in a git-ignored file instead of the shell.
 * A variable already set in the environment wins over the file. Returns the
 * names it set and never the values, so a caller can say what it read
 * without printing a secret.
 */
export function loadEnvFile(dir: string, env: NodeJS.ProcessEnv = process.env): { file?: string; names: string[] } {
  const file = path.join(dir, ENV_FILE);
  if (!fs.existsSync(file)) return { names: [] };
  const values = parseEnv(fs.readFileSync(file, "utf8"));
  const names: string[] = [];
  for (const [name, value] of Object.entries(values)) {
    if (env[name] !== undefined || value === undefined || value === "") continue;
    env[name] = value;
    names.push(name);
  }
  return { file, names };
}
