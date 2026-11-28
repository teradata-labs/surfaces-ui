# `packages/discovery`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `packages/discovery` | `createDiscovery({ dataSource })`: the reference `Discovery` backend. Keyword search (BM25 with stemming and prefixes), optional semantic and hybrid search through an `Embedder`, profiles through aggregate queries, inferred joins, context packs and their rendering (`renderContext`). Runs on any `DataSource`, in a server or a browser. Pluggable `Embedder`, `LanguageModel` and `DiscoveryStore`. |

## Discovery rules

- Components never call an embedding or language model. They call `Discovery`; the backend decides what may be indexed, embedded or sent to a model.
- **Data values are withheld by default.** Only names, types, descriptions and counts are indexed, embedded, profiled or put in agent context. A source must be listed in `allowSampleValues` before ranges, common values or sample rows appear anywhere. Never add a code path that embeds or sends row values for a source that is not listed.
- Generated text is a proposal. `describe` stores nothing; only `saveDescription` does, and it records whether a person or a model wrote the text. Never auto-save model output.
- Always show who produced an answer (`generated_by`). With no language model configured the backend answers with search results labelled `placeholder`; do not hide that label.
- SQL proposed by a model is shown and offered (`onUseSql`), never run automatically.
- Inferred joins are guesses from names and types and must stay labelled "Inferred". Foreign keys a source declares (`TableDetail.foreign_keys`) come back from `getRelated` with `inferred: false`, are labelled "Declared", and no guess is added beside them.
- **Certification is a person's decision.** `setCertification` records who certified or deprecated an object, when and why. A model never sets it, and the controls appear only when the host passes `certifier` (who may certify is the host's rule; the dev server does not check). Certified objects rank higher in search and deprecated ones lower; neither is hidden. Show the mark with `CertificationBadge`, which uses text and a symbol as well as colour.
- Distinct counts in a profile are estimates (`distinct_count_estimated`); show them with "~".

## Discovery and agent context

```tsx
import { DiscoveryProvider, DataSearch, ObjectDetail, ContextBuilder, addToContext, emptyContextDraft, tableRef } from "@surfaces-ui/components";
import { connectDiscovery } from "@surfaces-ui/client-connect"; // or createDiscovery({ dataSource }) from @surfaces-ui/discovery

<DiscoveryProvider discovery={connectDiscovery({ baseUrl: "http://localhost:5220" })}>
  <DataSearch onOpen={(object) => setOpen(object.ref)} />
  <ObjectDetail objectRef={tableRef("lake", "orders")} />
  <ContextBuilder value={draft} onChange={setDraft} />
</DiscoveryProvider>
```

- Server config (`surfaces.config.ts`): `discovery: { embedder: "local", allowSampleValues: ["lake"], storeDir: ".surfaces" }`. All three are optional; the defaults are keyword search, no data values, and `.surfaces`.
- Context packs are saved as JSON files in `<storeDir>/context/`, one per pack, so a consumer repo can review and commit them. `renderContextPack` returns the exact text an agent receives plus a token estimate.
- To plug in a model: pass `languageModel: { id, complete(prompt) }` or `embedder: { id, embed(texts) }` to `createDiscovery`, or implement `Discovery` yourself (for example on top of Loom).
- Not built yet: lineage (upstream/downstream), saved queries and documents as searchable objects, tags and owners, and exposing packs as an MCP resource (planned with the MCP phase).
