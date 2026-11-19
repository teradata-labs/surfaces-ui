import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type SurfacesConfig, defineConfig } from "@surfaces-ui/dev-server";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * A store visit form the server owns: its fields, their rules and where
 * submissions are kept are all set here. A client sends a form id and
 * values, nothing else.
 *
 * The server appends each submission to `<storeDir>/forms/store-visit.jsonl`.
 * The `forms` source reads that same file as a read-only table, so what was
 * submitted can be queried, charted and exported like any other data.
 */
export function writebackConfig(storeDir = path.join(here, ".surfaces")): SurfacesConfig {
  const submissions = path.join(storeDir, "forms", "store-visit.jsonl");
  // The table is a view over the file, so the file must exist when the server starts; empty is fine.
  fs.mkdirSync(path.dirname(submissions), { recursive: true });
  fs.closeSync(fs.openSync(submissions, "a"));

  return defineConfig({
    forms: [
      {
        id: "store-visit",
        title: "Store visit",
        description: "What you found on a visit to a store.",
        // Shown to people so they know where the data goes. The server, not this text, decides.
        target: "forms.store_visits",
        fields: [
          { name: "store", label: "Store", type: "choice", options: ["Leeds", "York", "Hull"], required: true },
          { name: "visited_on", label: "Visited on", type: "date", required: true },
          { name: "rating", label: "Rating", type: "integer", min: 1, max: 5, required: true, help: "1 is poor, 5 is excellent." },
          { name: "follow_up", label: "Needs a follow-up visit", type: "boolean" },
          { name: "note", label: "Note", type: "longtext", maxLength: 500 },
        ],
      },
    ],
    sources: [{ id: "forms", displayName: "Form submissions", engine: "duckdb", tables: [{ name: "store_visits", format: "json", path: submissions, comment: "One row per store visit form submitted." }] }],
    discovery: { storeDir },
    // A submission does not clear kept results, so a kept query over this file would miss
    // later submissions. Every query here is read from the file as it is now.
    storedResults: false,
  });
}
