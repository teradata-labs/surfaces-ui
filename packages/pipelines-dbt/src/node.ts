import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ArtifactReader } from "./artifacts.js";
import type { DbtInvoke } from "./index.js";

/** Reads dbt's artifacts from a project's target directory (`<project>/target` by default). A file that is not there is left out. */
export function targetDir(dir: string): ArtifactReader {
  return async (file) => {
    try {
      return await readFile(path.join(dir, file), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  };
}

export interface DbtCommandOptions {
  /** The dbt project's directory (where dbt_project.yml is). */
  projectDir: string;
  /** Where profiles.yml is, when not the project or ~/.dbt. Credentials stay in the profile and the environment, never here. */
  profilesDir?: string;
  /** The profile's target to build. */
  target?: string;
  /** The dbt executable. Defaults to "dbt" on the PATH. */
  command?: string;
  /** The environment dbt runs with. Defaults to this process's, which is where a profile's env_var() credentials come from. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Runs the dbt CLI in a project: the arguments go to dbt as a list, never
 * through a shell, followed by the project and profile settings. Output goes
 * to dbt's own log; nothing it prints is kept here, since it can include the
 * warehouse's messages.
 */
export function dbtCommand(options: DbtCommandOptions): DbtInvoke {
  return (args, { signal }) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        options.command ?? "dbt",
        [...args, "--project-dir", options.projectDir, ...(options.profilesDir ? ["--profiles-dir", options.profilesDir] : []), ...(options.target ? ["--target", options.target] : [])],
        { cwd: options.projectDir, env: options.env ?? process.env, stdio: "ignore", shell: false, signal },
      );
      child.on("error", (error) => ((error as Error).name === "AbortError" ? resolve({ exitCode: 130 }) : reject(error)));
      child.on("close", (code) => resolve({ exitCode: code ?? 1 }));
    });
}
