import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";
import { run } from "../src/cli.js";

// Each test runs in a new empty directory. An object lets other files read the new path.
export const project = { root: "" };

beforeEach(() => {
  project.root = mkdtempSync(join(tmpdir(), "handoff-test-"));
});

afterEach(() => {
  rmSync(project.root, { recursive: true, force: true });
});

// Runs a handoff command in the test directory and collects what it prints.
export function runCli(...argv: string[]) {
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
    project.root,
  );
  return { exitCode, stdout, stderr };
}

export function writeLog(name: string, content: string) {
  writeFileSync(join(project.root, ".handoff", "logs", name), content);
}
