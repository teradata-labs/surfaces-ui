import { ConnectionBuilder, type ConnectionDraft, SourceList, emptyConnectionDraft } from "@surfaces-ui/components";
import { useState } from "react";
import { FilesPanel } from "../FilesPanel.js";
import type { ActiveSource } from "../source.js";
import { SeedsPanel, type SeedWorkingCopy } from "./SeedsPanel.js";

/** The sources this page can reach, the seed models, form submissions, and how to connect another. */
export function SourcesPage({ source, workingCopy }: { source?: ActiveSource; workingCopy?: SeedWorkingCopy }) {
  const [draft, setDraft] = useState<ConnectionDraft>(emptyConnectionDraft);
  return (
    <div className="stage">
      <section className="card">
        <div className="card-head">
          <h2>Sources</h2>
        </div>
        <SourceList />
      </section>
      {source && (
        <section className="card">
          <div className="card-head">
            <h2>Folders and files</h2>
          </div>
          <p className="hint">What the picked source reads from, where its backend can list it, and any folder you open from this computer.</p>
          <FilesPanel source={source} height={320} />
        </section>
      )}
      {source && <SeedsPanel source={source} workingCopy={workingCopy} />}
      <section className="card">
        <div className="card-head">
          <h2>Connect Parquet, Delta Lake or Iceberg data</h2>
        </div>
        <ConnectionBuilder value={draft} onChange={setDraft} />
      </section>
    </div>
  );
}
