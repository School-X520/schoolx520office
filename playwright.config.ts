import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  // CI에서는 재시도로 플레이크를 흡수하고, 로컬에서는 실패를 빠르게 드러낸다.
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://127.0.0.1:3137",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm exec next dev -p 3137",
    url: "http://127.0.0.1:3137",
    // CI에서는 깨끗한 서버를 강제하고(오염된 기존 서버 재사용 방지), 로컬에서는 기존 서버를 재사용한다.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
