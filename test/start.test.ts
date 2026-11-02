import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../src/cli.js";
import { estimateTokens } from "../src/start.js";

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

function writeLog(name: string, content: string) {
  writeFileSync(join(root, ".handoff", "logs", name), content);
}

describe("handoff start", () => {
  it("prints the instructions, spec and rules", () => {
    runCli("init");
    writeFileSync(join(root, ".handoff", "spec.md"), "my spec");
    writeFileSync(join(root, ".handoff", "rules.md"), "my rules");

    const result = runCli("start");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('<file path=".handoff/INSTRUCTIONS.md">');
    expect(result.stdout).toContain("my spec");
    expect(result.stdout).toContain("my rules");
    expect(result.stdout).toContain("No logs yet");
  });

  it("includes only the latest log and lists the older ones", () => {
    runCli("init");
    writeLog("2026-11-01.md", "first day");
    writeLog("2026-11-02.md", "second day");
    writeLog("2026-11-03.md", "third day");

    const { stdout } = runCli("start");

    expect(stdout).toContain("third day");
    expect(stdout).not.toContain("first day");
    expect(stdout).not.toContain("second day");
    expect(stdout).toContain("- .handoff/logs/2026-11-01.md");
    expect(stdout).toContain("- .handoff/logs/2026-11-02.md");
    expect(stdout).not.toContain("- .handoff/logs/2026-11-03.md");
  });

  it("ignores logs with invalid names", () => {
    runCli("init");
    writeLog("2026-11-03.md", "real log");
    writeLog("notes.md", "not a log");

    const { stdout } = runCli("start");

    expect(stdout).toContain("real log");
    expect(stdout).not.toContain("not a log");
  });

  it("keeps the token estimate out of the context", () => {
    runCli("init");
    writeLog("2026-11-01.md", "x".repeat(4000));
    writeLog("2026-11-02.md", "latest");

    const { stdout, stderr } = runCli("start");

    expect(stdout).not.toContain("Estimated tokens");
    const match = /~(\d+) \(~(\d+) with all logs\)/.exec(stderr);
    expect(Number(match?.[2]) - Number(match?.[1])).toBe(1000);
  });

  it("asks for init when .handoff is missing", () => {
    const result = runCli("start");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("handoff init");
    expect(result.stdout).toBe("");
  });

  it("reports a missing required file", () => {
    runCli("init");
    rmSync(join(root, ".handoff", "rules.md"));

    const result = runCli("start");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("rules.md");
    expect(result.stdout).toBe("");
  });
});

describe("estimateTokens", () => {
  it("counts ASCII as about 4 characters per token", () => {
    expect(estimateTokens("abcdefgh")).toBe(2);
  });

  it("counts Korean as about 1.5 characters per token", () => {
    expect(estimateTokens("가나다")).toBe(2);
  });

  it("returns 0 for empty text", () => {
    expect(estimateTokens("")).toBe(0);
  });
});
