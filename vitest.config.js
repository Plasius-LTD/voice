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
    poolOptions: {
      // CI runners are memory constrained; run tests in a single worker to avoid jsdom-heavy OOMs.
      threads: isCI ? { singleThread: true } : undefined,
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "src/types/**/*.d.ts",
        "tests/**",
        "temp/**",
        "dist/**",
        "**/*.config.{js,ts}",
        "**/.eslintrc.{js,cjs}",
      ],
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
