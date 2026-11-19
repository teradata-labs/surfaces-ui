import os from "node:os";
import path from "node:path";
import type { Embedder } from "@surfaces-ui/discovery";

export interface LocalEmbedderOptions {
  /** Hugging Face model ID. Defaults to a small general-purpose sentence model (about 25 MB). */
  model?: string;
  /**
   * Where the model is downloaded and kept. Defaults to
   * `$SURFACES_CACHE_DIR/models` or `~/.cache/surfaces/models` — outside any
   * repository, so model files are never committed.
   */
  cacheDir?: string;
}

export const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";

export function defaultCacheDir(): string {
  return path.join(process.env.SURFACES_CACHE_DIR ?? path.join(os.homedir(), ".cache", "surfaces"), "models");
}

/**
 * An Embedder that runs a small model on this machine. Text is never sent to
 * a service. The model is fetched once, on first use, into the cache folder.
 */
export function localEmbedder(options: LocalEmbedderOptions = {}): Embedder {
  const model = options.model ?? DEFAULT_MODEL;
  let loading: Promise<(texts: string[]) => Promise<Float32Array[]>> | undefined;

  const load = async () => {
    const transformers = await import("@huggingface/transformers");
    transformers.env.cacheDir = options.cacheDir ?? defaultCacheDir();
    const extract = await transformers.pipeline("feature-extraction", model, { dtype: "q8" });
    return async (texts: string[]) => {
      const output = await extract(texts, { pooling: "mean", normalize: true });
      const [rows, width] = output.dims as [number, number];
      const data = output.data as Float32Array;
      return Array.from({ length: rows }, (_, i) => data.slice(i * width, (i + 1) * width));
    };
  };

  return {
    id: model,
    async embed(texts) {
      if (texts.length === 0) return [];
      loading ??= load().catch((error) => {
        loading = undefined;
        throw error;
      });
      return (await loading)(texts);
    },
  };
}
