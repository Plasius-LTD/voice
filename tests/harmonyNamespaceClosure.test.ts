import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function collectMarkdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectMarkdownFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : [];
  });
}

describe("Project Harmony documentation namespace", () => {
  it("contains no legacy Isekai references in active README or docs", () => {
    const activeDocumentation = [
      path.join(repositoryRoot, "README.md"),
      ...collectMarkdownFiles(path.join(repositoryRoot, "docs")),
    ];
    const violations = activeDocumentation.filter((filePath) =>
      /\bisekai\b/iu.test(readFileSync(filePath, "utf8"))
    );

    expect(violations.map((filePath) => path.relative(repositoryRoot, filePath))).toEqual(
      []
    );
  });
});
