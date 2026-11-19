import { create, type DescMessage, type MessageInitShape } from "@bufbuild/protobuf";
import {
  type ListModelBackendsRequestSchema,
  type ListModelBackendsResponse,
  ListModelBackendsResponseSchema,
  type ModelBackend,
  ModelBackendSchema,
  type SetModelRequestSchema,
  type SetModelResponse,
  SetModelResponseSchema,
} from "@surfaces-ui/proto";
import type { CallOptions } from "./datasource.js";

type Unary<Req extends DescMessage, Res> = (request: MessageInitShape<Req>, options?: CallOptions) => Promise<Res>;

/**
 * Which model each agent backend uses, and the choice of another. It never
 * carries a key: a backend only says which environment variable its key is
 * read from and whether it is set.
 */
export interface ModelSettings {
  listModelBackends: Unary<typeof ListModelBackendsRequestSchema, ListModelBackendsResponse>;
  /** Fails with `ModelChoiceError` for an unknown backend or a model it does not offer. */
  setModel: Unary<typeof SetModelRequestSchema, SetModelResponse>;
}

export class ModelChoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelChoiceError";
  }
}

/**
 * One backend a server can run. `describe` is read on every listing, so it
 * can report live state (a key set since start, a server that stopped).
 * `setModel` applies the choice: change a variable, rewrite a file and
 * restart a process, whatever the backend needs.
 */
export interface ModelBackendHandle {
  describe(): MessageInitShape<typeof ModelBackendSchema> | Promise<MessageInitShape<typeof ModelBackendSchema>>;
  setModel(model: string): void | Promise<void>;
}

/** The backends and which one answers turns, behind `ModelSettings`. */
export function modelSettings(options: { backends: ModelBackendHandle[]; active?(): string; setActive?(id: string): void }): ModelSettings {
  const describeAll = async () => {
    const active = options.active?.();
    return Promise.all(
      options.backends.map(async (handle) => {
        const backend = create(ModelBackendSchema, await handle.describe());
        if (active !== undefined) backend.active = backend.id === active;
        return { handle, backend };
      }),
    );
  };
  return {
    async listModelBackends() {
      return create(ListModelBackendsResponseSchema, { backends: (await describeAll()).map((b) => b.backend) });
    },
    async setModel(request) {
      const found = (await describeAll()).find((b) => b.backend.id === request.backendId);
      if (!found) throw new ModelChoiceError(`No model backend "${request.backendId ?? ""}".`);
      const model = (request.model ?? "").trim();
      if (!model) throw new ModelChoiceError("Choose a model.");
      if (!found.backend.anyModel && !found.backend.models.some((m) => m.id === model))
        throw new ModelChoiceError(`"${found.backend.label}" does not offer the model "${model}".`);
      await found.handle.setModel(model);
      if (request.makeActive) options.setActive?.(found.backend.id);
      const after = (await describeAll()).find((b) => b.backend.id === request.backendId)!;
      return create(SetModelResponseSchema, { backend: after.backend });
    },
  };
}

/** Backends held in memory, for tests and demos: choosing a model changes only the stored value. */
export function memoryModelSettings(backends: MessageInitShape<typeof ModelBackendSchema>[]): ModelSettings & { backends(): ModelBackend[] } {
  const held = backends.map((b) => create(ModelBackendSchema, b));
  let active = held.find((b) => b.active)?.id ?? "";
  const settings = modelSettings({
    backends: held.map((b) => ({ describe: () => b, setModel: (model) => void (b.model = model) })),
    active: () => active,
    setActive: (id) => void (active = id),
  });
  return { ...settings, backends: () => held.map((b) => ({ ...b, active: b.id === active })) };
}
