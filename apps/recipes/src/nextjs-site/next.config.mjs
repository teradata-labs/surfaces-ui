import fs from "node:fs";
import path from "node:path";

/** The folder holding the workspace's lockfile, which the bundler must be allowed to read from. */
function workspaceRoot(dir) {
  for (let at = dir; at !== path.dirname(at); at = path.dirname(at)) {
    if (fs.existsSync(path.join(at, "pnpm-lock.yaml"))) return at;
  }
  return dir;
}

/** Static export: every route is written as HTML at build time, and nothing runs on a server. */
export default {
  output: "export",
  trailingSlash: true,
  // Only needed inside a pnpm workspace, where packages are linked from outside the app's folder.
  turbopack: { root: workspaceRoot(import.meta.dirname) },
};
