import { defineConfig } from "@playwright/test";

const baseURL = process.env.NOTEPAD_MIRROR_BASE_URL ?? "http://127.0.0.1:43117";

export default defineConfig({
  testDir: "./tests/headless",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  outputDir: "artifacts/headless/test-results",
  reporter: [["list"], ["html", { outputFolder: "artifacts/headless/report", open: "never" }]],
  use: {
    baseURL,
    headless: true,
    trace: "on",
    screenshot: "on",
    recordHar: {
      path: "artifacts/latest/ui/network.har",
      mode: "minimal",
    },
  },
  webServer: {
    command: "npm start",
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
