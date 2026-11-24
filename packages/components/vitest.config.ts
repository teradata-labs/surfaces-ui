import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests that wait for a component to fetch and draw (findBy, waitFor) get more than Testing Library's one second:
    // on a busy CI runner a first query and its render have taken longer, and failed tests that were right.
    setupFiles: ["./test-setup.ts"],
  },
});
