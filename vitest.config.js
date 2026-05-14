import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isCI = process.env.CI === "true";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["tests/mocks/environment.setup.ts"],
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
    // Vitest 4 removed poolOptions; keep CI on one worker to avoid jsdom-heavy OOMs.
    maxWorkers: isCI ? 1 : undefined,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "src/types/**/*.d.ts",
        "tests/**",
        "temp/**",
        "dist/**",
        "coverage/**",
        "scripts/**",
        "**/*.config.{js,ts}",
        "**/.eslintrc.{js,cjs}",
        "eslint.config.js",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 75,
        branches: 60,
      },
    },
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
        // If you have multiple pkg roots in a monorepo, hard-aliase them as well
      },
    },
  },
});
