import { defineConfig, devices } from "@playwright/test";

// The playground on a port of its own, pointed at a server address nothing answers on, so every test runs
// against DuckDB in the page and the sample data, whether or not a dev server is running on this machine.
const PORT = Number(process.env.SURFACES_E2E_PORT ?? 5310);

export default defineConfig({
  testDir: "tests",
  // DuckDB in the page loads a sample model the first time it is picked.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
    { name: "phone", use: { ...devices["Pixel 7"] }, grep: /@phone/ },
  ],
  webServer: {
    command: `pnpm --filter @surfaces-ui/playground exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_SURFACES_SERVER: "http://127.0.0.1:9" },
    // Vite warns about DuckDB-wasm's source maps on every load; a failure to start shows as the timeout above.
    stdout: "ignore",
    stderr: "ignore",
  },
});
