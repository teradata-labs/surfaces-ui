#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { toJson } from "@bufbuild/protobuf";
import type { Pipelines } from "@surfaces-ui/data";
import { CheckSeverity, DatasetKind, type Pipeline, PipelineSchema, RefreshKind, type Run, RunSchema, RunState } from "@surfaces-ui/proto";
import { CONFIG_FILES, type SurfacesConfig, loadConfig, openSources, serverOptions } from "./config.js";
import { loadEnvFile } from "./env.js";
import { createSurfacesServer } from "./server.js";

const USAGE = `Usage: surfaces-pipelines <command> [options]

  list                       The pipelines the config defines or a person saved
  describe <id>              Datasets, what each reads, grain, key, columns and checks
  check <id>                 Checks the pipeline without building anything
  run <id>                   Builds the pipeline, then runs its checks

Options:
  --select <name>            Only this dataset; name+ adds what reads it, +name what it reads (repeatable)
  --full-refresh --yes       Clear the chosen tables first; needs --yes, since it destroys data
  --json                     Print the result as JSON
  --config <file>            The config to read (default: ${CONFIG_FILES[0]})

Exits 1 when a dataset fails to build or a check that fails the run does, so cron and CI can use it.`;

const args = process.argv.slice(2);
const has = (name: string) => args.includes(name);
const values = (name: string) => args.flatMap((arg, i) => (arg === name && args[i + 1] ? [args[i + 1]!] : []));
const positional = args.filter((arg, i) => !arg.startsWith("--") && !["--select", "--config"].includes(args[i - 1] ?? ""));
const [command, id] = positional;
const json = has("--json");
const bigints = (_: string, value: unknown) => (typeof value === "bigint" ? Number(value) : value);
const print = (value: unknown) => console.log(JSON.stringify(value, bigints, 2));
const STATE: Record<number, string> = { [RunState.COMPLETED]: "built", [RunState.FAILED]: "failed", [RunState.SKIPPED]: "skipped", [RunState.CANCELLED]: "cancelled", [RunState.RUNNING]: "running", [RunState.QUEUED]: "queued" };

async function open(): Promise<{ pipelines: Pipelines; close(): Promise<void> }> {
  const file = values("--config")[0] ?? CONFIG_FILES.find((f) => fs.existsSync(path.resolve(f)));
  // Secrets come from the environment or a git-ignored .env.local beside the config, as for the dev server.
  loadEnvFile(path.dirname(path.resolve(file ?? CONFIG_FILES[0]!)));
  const { config, dir }: { config: SurfacesConfig; dir: string } = file ? await loadConfig(file) : { config: { seeds: true }, dir: process.cwd() };
  const sources = await openSources(config, dir);
  const server = await createSurfacesServer({ ...(await serverOptions(config, sources, dir)), discovery: false });
  if (!server.pipelines) throw new Error("This config defines no pipelines.");
  return { pipelines: server.pipelines, close: () => server.close() };
}

function describe(pipeline: Pipeline) {
  const lines = [`${pipeline.summary?.name} (${pipeline.summary?.id}) on ${pipeline.summary?.sourceId}${pipeline.version ? `, version ${pipeline.version}` : ""}`];
  if (pipeline.summary?.description) lines.push(pipeline.summary.description);
  for (const dataset of pipeline.datasets.filter((d) => d.sql)) {
    lines.push("", `${dataset.name}${dataset.layer ? ` [${dataset.layer}]` : ""}${dataset.grain ? `: ${dataset.grain}` : ""}`);
    if (dataset.inputs.length > 0) lines.push(`  reads ${dataset.inputs.join(", ")}${dataset.inputsDeclared ? "" : " (worked out from the query)"}`);
    if (dataset.primaryKey.length > 0) lines.push(`  key ${dataset.primaryKey.join(", ")}`);
    for (const column of dataset.columns) lines.push(`  ${column.name}${column.type ? ` ${column.type}` : ""}${column.description ? ` — ${column.description}` : ""}`);
    for (const check of dataset.checks) lines.push(`  check ${check.name}${check.severity === CheckSeverity.WARN ? " (warns)" : ""}`);
    if (dataset.builtAt) lines.push(`  built ${dataset.builtAt} by ${dataset.lastRunId}`);
  }
  return lines.join("\n");
}

function report(run: Run, views: Set<string>) {
  const lines = [`${run.id}: ${STATE[run.state] === "built" ? "completed" : (STATE[run.state] ?? "unknown")}${run.dryRun ? " (checked, nothing built)" : ""}`];
  for (const dataset of run.datasetRuns) {
    const built = dataset.state === RunState.COMPLETED || dataset.rowsWritten > 0n;
    lines.push(`  ${dataset.name}: ${STATE[dataset.state] ?? "?"}${built ? (views.has(dataset.name) ? " as a view" : `, ${Number(dataset.rowsWritten).toLocaleString("en")} rows`) : ""}`);
    for (const check of dataset.checks) lines.push(`    ${check.failedRecords > 0n ? (check.severity === CheckSeverity.WARN ? "warn" : "FAIL") : "pass"} ${check.name}: ${check.summary}`);
    if (dataset.errorMessage && dataset.checks.length === 0) lines.push(`    ${dataset.errorMessage}`);
  }
  if (run.errorMessage) lines.push(run.errorMessage);
  return lines.join("\n");
}

async function main(): Promise<number> {
  if (!command || has("--help") || !["list", "describe", "check", "run"].includes(command) || (command !== "list" && !id)) {
    console.error(USAGE);
    return 2;
  }
  const fullRefresh = has("--full-refresh");
  if (fullRefresh && !has("--yes")) {
    console.error("A full refresh clears the chosen tables before building them. Add --yes to go ahead.");
    return 2;
  }
  const { pipelines, close } = await open();
  try {
    if (command === "list") {
      const { pipelines: list } = await pipelines.listPipelines({});
      if (json) print(list.map((p) => ({ id: p.id, name: p.name, sourceId: p.sourceId, datasets: p.datasetCount, latestRun: p.latestRun && { id: p.latestRun.id, state: STATE[p.latestRun.state] } })));
      else for (const p of list) console.log(`${p.id}\t${p.datasetCount} datasets\t${p.latestRun ? `last run ${STATE[p.latestRun.state] ?? "?"}` : "never run"}\t${p.name}`);
      return 0;
    }
    if (command === "describe") {
      const { pipeline } = await pipelines.getPipeline({ id });
      if (json) print(toJson(PipelineSchema, pipeline!));
      else console.log(describe(pipeline!));
      return 0;
    }
    let run = (await pipelines.startRun({ pipelineId: id, select: values("--select"), dryRun: command === "check", refreshKind: fullRefresh ? RefreshKind.FULL_REFRESH : RefreshKind.REFRESH, confirmFullRefresh: fullRefresh, trigger: "cli", startedBy: process.env.USER ? `${process.env.USER} (cli)` : "cli" })).run!;
    while (run.state === RunState.RUNNING) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      run = (await pipelines.getRun({ pipelineId: id, runId: run.id })).run!;
    }
    if (json) print(toJson(RunSchema, run));
    else {
      const { pipeline } = await pipelines.getPipeline({ id });
      console.log(report(run, new Set(pipeline?.datasets.filter((d) => d.kind === DatasetKind.VIEW).map((d) => d.name))));
    }
    return run.state === RunState.COMPLETED ? 0 : 1;
  } finally {
    await close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
