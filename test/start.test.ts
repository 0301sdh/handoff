import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { project, runCli, writeLog } from "./helpers.js";

describe("handoff start", () => {
  it("prints the instructions, spec and rules", () => {
    runCli("init");
    writeFileSync(join(project.root, ".handoff", "spec.md"), "my spec");
    writeFileSync(join(project.root, ".handoff", "rules.md"), "my rules");

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

  it("prints the context as JSON with --json", () => {
    runCli("init");

    const { exitCode, stdout } = runCli("start", "--json");

    expect(exitCode).toBe(0);
    const output = JSON.parse(stdout) as { additionalContext: string };
    expect(output.additionalContext).toContain('<file path=".handoff/spec.md">');
  });

  it("rejects --json on other commands", () => {
    runCli("init");

    expect(runCli("end", "--json").exitCode).toBe(2);
  });

  it("asks for init when .handoff is missing", () => {
    const result = runCli("start");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("handoff init");
    expect(result.stdout).toBe("");
  });

  it("reports a missing required file", () => {
    runCli("init");
    rmSync(join(project.root, ".handoff", "rules.md"));

    const result = runCli("start");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("rules.md");
    expect(result.stdout).toBe("");
  });
});
