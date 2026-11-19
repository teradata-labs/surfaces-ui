import { defineConfig } from "vitest/config";

// Tests run from the package root; vite.config.ts is only for the app page build.
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
