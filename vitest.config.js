import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "src/types/**/*.d.ts",
        "tests/**",
        "dist/**",
        "**/*.config.{js,ts}",
        "**/.eslintrc.{js,cjs}",
      ],
    },
  },
});
