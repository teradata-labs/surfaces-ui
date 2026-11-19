import { defineConfig } from "vitest/config";

// Tests use the packages as they are; the ECharts stand-in is only for the bundle (vite.config.ts).
export default defineConfig({ test: { include: ["src/**/*.test.tsx"] } });
