import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Point to adapter source so Vite can resolve it without a prior build.
      // Tests mock the adapter entirely, so the actual source is never executed.
      "@surfacesui/mcp-adapter": resolve(
        __dirname,
        "../mcp-adapter/src/index.ts",
      ),
    },
  },
});
