import fs from "node:fs";
import path from "node:path";
import { type MessageInitShape, create, fromJson, toJson } from "@bufbuild/protobuf";
import { type FormSpec, type Forms, type LibraryStorage, type MemorySemanticsOptions, type Semantics, type SurfaceLibrary, formDefinitions, memoryForms, memorySemantics, memorySurfaceLibrary } from "@surfaces-ui/data";
import type { PipelineStore, RunStore, SavedPipeline } from "@surfaces-ui/pipelines";
import { ListSubmissionsResponseSchema, type Run, RunSchema, type Submission, SubmissionSchema } from "@surfaces-ui/proto";

const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

/**
 * Keeps saved surfaces as one JSON file each in a folder, every version in
 * the file, so they can be reviewed and committed like other project files.
 */
export function fileLibraryStorage(dir: string, idPattern: RegExp = ID): LibraryStorage {
  return {
    load() {
      if (!fs.existsSync(dir)) return undefined;
      const all: Record<string, unknown> = {};
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
        try {
          all[file.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        } catch {
          // A file that does not parse is left alone and not offered.
        }
      }
      return JSON.stringify(all);
    },
    save(_key, value) {
      const all = JSON.parse(value) as Record<string, unknown>;
      fs.mkdirSync(dir, { recursive: true });
      for (const [id, versions] of Object.entries(all)) {
        if (!idPattern.test(id)) continue;
        fs.writeFileSync(path.join(dir, `${id}.json`), `${JSON.stringify(versions, null, 2)}\n`);
      }
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
        if (!Object.hasOwn(all, file.slice(0, -5))) fs.rmSync(path.join(dir, file), { force: true });
      }
    },
  };
}

export function fileSurfaceLibrary(dir: string): SurfaceLibrary {
  return memorySurfaceLibrary({ storage: fileLibraryStorage(dir) });
}

/**
 * Semantic models as one JSON file each in a folder (`<name>.json`, every
 * kept version in it, in the contract's JSON form), so a project's models
 * are reviewed and committed like its other files.
 */
export function fileSemantics(dir: string, options: Omit<MemorySemanticsOptions, "storage"> = {}): Semantics {
  return memorySemantics({ ...options, storage: fileLibraryStorage(dir, /^[a-z][a-z0-9_]{0,63}$/) });
}

/** A form as `surfaces.config.ts` declares it. */
export type FormConfig = FormSpec;

/**
 * Forms whose submissions are appended to one JSON-lines file per form in a
 * folder. Values are checked against the form's fields before anything is
 * written; nothing a client sends chooses the file.
 */
export function fileForms(dir: string, forms: FormConfig[]): Forms {
  const fileOf = (formId: string) => path.join(dir, `${formId}.jsonl`);
  let counter = Date.now();
  const inner = memoryForms({
    forms: formDefinitions(forms),
    // Unique across restarts, unlike a counter from 1.
    newId: () => `sub-${(counter++).toString(36)}`,
    onSubmit(submission) {
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(fileOf(submission.formId), `${JSON.stringify(toJson(SubmissionSchema, submission))}\n`);
    },
  });
  const read = (formId: string): Submission[] => {
    if (!ID.test(formId) || !fs.existsSync(fileOf(formId))) return [];
    return fs
      .readFileSync(fileOf(formId), "utf8")
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [fromJson(SubmissionSchema, JSON.parse(line))];
        } catch {
          return [];
        }
      });
  };
  return {
    ...inner,
    async listSubmissions(request) {
      const ids = request.formId ? [request.formId] : forms.map((f) => f.id);
      const all = ids.flatMap(read).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      const start = request.pageToken ? Number(request.pageToken) : 0;
      const size = request.pageSize || 100;
      return create(ListSubmissionsResponseSchema, { submissions: all.slice(start, start + size), nextPageToken: start + size < all.length ? String(start + size) : "" });
    },
  };
}

const PIPELINE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;

/**
 * Pipelines a person approved, as one JSON file each in a folder
 * (`<id>.json`, every version in it), so they are reviewed and committed like
 * other project files. Only the runner writes here, after its checks.
 */
export function filePipelineStore(dir: string): PipelineStore {
  return {
    async list() {
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json") && PIPELINE_ID.test(f.slice(0, -5)))
        .flatMap((file) => {
          try {
            const saved = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as SavedPipeline;
            return saved?.definition?.id === file.slice(0, -5) ? [saved] : [];
          } catch {
            // A file that does not parse is left alone and not offered.
            return [];
          }
        });
    },
    async put(saved) {
      if (!PIPELINE_ID.test(saved.definition.id)) throw new Error(`Not a pipeline ID: ${saved.definition.id}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${saved.definition.id}.json`), `${JSON.stringify(saved, null, 2)}\n`);
    },
  };
}

/**
 * Runs kept as one JSON file per pipeline in a folder, newest first and at
 * most `limit` of them, so history outlives a restart. A run is written as it
 * changes; the last write wins, so one server should own a folder.
 */
export function fileRunStore(dir: string, limit = 50): RunStore {
  const fileOf = (pipelineId: string) => path.join(dir, `${pipelineId}.json`);
  const read = (file: string): Run[] => {
    try {
      return (JSON.parse(fs.readFileSync(file, "utf8")) as unknown[]).map((run) => fromJson(RunSchema, run as never, { ignoreUnknownFields: true }));
    } catch {
      return [];
    }
  };
  return {
    async load() {
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .flatMap((f) => read(path.join(dir, f)))
        .sort((a, b) => b.startTime.localeCompare(a.startTime));
    },
    async save(run) {
      if (!PIPELINE_ID.test(run.pipelineId)) return;
      const file = fileOf(run.pipelineId);
      const runs = fs.existsSync(file) ? read(file) : [];
      const index = runs.findIndex((r) => r.id === run.id);
      if (index >= 0) runs[index] = run;
      else runs.unshift(run);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(runs.slice(0, limit).map((r) => toJson(RunSchema, r)), null, 1)}\n`);
    },
  };
}
