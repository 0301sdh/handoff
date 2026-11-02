import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../src/cli.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "handoff-test-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function runCli(...argv: string[]) {
  let stdout = "";
  let stderr = "";
  const exitCode = run(
    argv,
    {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    },
    root,
  );
  return { exitCode, stdout, stderr };
}

describe("handoff init", () => {
  it("creates the handoff files", () => {
    const result = runCli("init");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("spec.md");
    for (const file of ["spec.md", "rules.md", "INSTRUCTIONS.md", "logs/.gitkeep"]) {
      expect(existsSync(join(root, ".handoff", file))).toBe(true);
    }
  });

  it("writes the headings the other commands rely on", () => {
    runCli("init");

    const spec = readFileSync(join(root, ".handoff", "spec.md"), "utf8");
    expect(spec).toContain("## 완료 조건");
    const rules = readFileSync(join(root, ".handoff", "rules.md"), "utf8");
    expect(rules).toContain("[R1]");
    const instructions = readFileSync(
      join(root, ".handoff", "INSTRUCTIONS.md"),
      "utf8",
    );
    expect(instructions).toContain("## 다음 할 일");
  });

  it("does not overwrite an existing setup", () => {
    runCli("init");
    const specPath = join(root, ".handoff", "spec.md");
    writeFileSync(specPath, "my spec");

    const result = runCli("init");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("already exists");
    expect(readFileSync(specPath, "utf8")).toBe("my spec");
  });

  it("does not replace a file named .handoff", () => {
    const path = join(root, ".handoff");
    writeFileSync(path, "a file");

    const result = runCli("init");

    expect(result.exitCode).toBe(1);
    expect(readFileSync(path, "utf8")).toBe("a file");
  });

  it("rejects extra arguments without creating anything", () => {
    const result = runCli("init", "somewhere");

    expect(result.exitCode).toBe(2);
    expect(existsSync(join(root, ".handoff"))).toBe(false);
  });

  it("shows help instead of running with --help", () => {
    const result = runCli("init", "--help");

    expect(result.stdout).toContain("Usage:");
    expect(existsSync(join(root, ".handoff"))).toBe(false);
  });
});
