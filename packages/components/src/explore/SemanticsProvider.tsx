import { type Semantics, StaleSemanticModelError } from "@surfaces-ui/data";
import type { SemanticModel } from "@surfaces-ui/proto";
import { useProvided, useTraced } from "@surfaces-ui/trace/react";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import { messageOf } from "../data/useRowWindow.js";
import type { Pill } from "./model.js";
import { promotePill } from "./semantic.js";

const SemanticsContext = createContext<Semantics | undefined>(undefined);

/** Supplies the store of semantic models to everything below it. Optional: without it, components generate their fields from the columns. */
export function SemanticsProvider({ semantics, children }: { semantics: Semantics | undefined; children: ReactNode }) {
  useProvided("semantics", semantics);
  return <SemanticsContext.Provider value={semantics}>{children}</SemanticsContext.Provider>;
}

export function useSemantics(given?: Semantics): Semantics | undefined {
  const fromContext = useContext(SemanticsContext);
  return useTraced("Semantics", given ?? fromContext);
}

export interface SemanticModelState {
  model?: SemanticModel;
  /** Why it could not be loaded or saved. */
  problem?: string;
  /** The store answered that there is no model of that name: one may be created under it. */
  missing: boolean;
  loading: boolean;
  /** Adds a pill to the model, or puts it in place of the field of the same name. Resolves to what happened, in a sentence. */
  promote(pill: Pill, all: Pill[]): Promise<string>;
  /** Saves a whole model as the next version. */
  save(model: SemanticModel, note: string): Promise<SemanticModel | undefined>;
  reload(): void;
}

/**
 * One semantic model by name, kept current, with saving. `editor` is
 * recorded as who saved and who defined what a person adds.
 */
export function useSemanticModel(name: string | undefined, options: { editor?: string; semantics?: Semantics } = {}): SemanticModelState {
  const semantics = useSemantics(options.semantics);
  const editor = options.editor ?? "you";
  const [model, setModel] = useState<SemanticModel | undefined>();
  const [problem, setProblem] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    if (!name) return setModel(undefined);
    if (!semantics) return setProblem(`There is no store of semantic models here, so "${name}" cannot be read.`);
    let live = true;
    setLoading(true);
    semantics
      .getSemanticModel({ name })
      .then((found) => live && (setModel(found.model), setProblem(undefined), setMissing(false)))
      .catch((error: unknown) => live && (setProblem(messageOf(error)), setMissing(/no semantic model|not found/i.test(messageOf(error)))))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [semantics, name, asked]);

  const save = useCallback(
    async (next: SemanticModel, note: string) => {
      if (!semantics) return undefined;
      try {
        const saved = await semantics.saveSemanticModel({ model: { ...next, savedBy: editor }, expectedVersion: model?.version ?? next.version, note });
        setModel(saved.model);
        setProblem(undefined);
        setMissing(false);
        return saved.model;
      } catch (error) {
        // Someone else saved first: show theirs, and say so.
        if (error instanceof StaleSemanticModelError || /saved by someone else/.test(messageOf(error))) setAsked((n) => n + 1);
        setProblem(messageOf(error));
        return undefined;
      }
    },
    [semantics, editor, model?.version],
  );

  const promote = useCallback(
    async (pill: Pill, all: Pill[]) => {
      if (!model) return "There is no model to add it to.";
      const had = [...model.dimensions, ...model.measures, ...model.metrics].some((f) => f.name === pill.id);
      const saved = await save(promotePill(model, pill, all, editor), `${had ? "Changed" : "Added"} ${pill.label}`);
      return saved ? `${pill.label} ${had ? "changed in" : "added to"} the ${saved.label || saved.name} model (version ${saved.version}). Every report on it now uses this definition.` : `${pill.label} was not saved to the model.`;
    },
    [model, save, editor],
  );

  return { model, problem, missing, loading, promote, save, reload: () => setAsked((n) => n + 1) };
}
