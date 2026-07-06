import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // .claude/**: 스폰된 태스크가 만든 git worktree(리포 전체 사본)가 vitest 수집에 섞여
    // Playwright e2e 스펙까지 끌려오는 것을 막는다.
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**", ".claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
