import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildEndPrompt } from "../src/end.js";
import { project, runCli } from "./helpers.js";

const TODAY = new Date(2026, 0, 5);

function promptFor(today: Date) {
  const result = buildEndPrompt(project.root, today);
  if (result.status !== "ready") {
    throw new Error(`Unexpected status: ${result.status}`);
  }
  return result.prompt;
}

describe("handoff end", () => {
  it("prints the wrap-up steps with the spec and rules", () => {
    runCli("init");
    writeFileSync(join(project.root, ".handoff", "spec.md"), "my spec");
    writeFileSync(join(project.root, ".handoff", "rules.md"), "my rules");

    const result = runCli("end");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("my spec");
    expect(result.stdout).toContain("my rules");
    expect(result.stdout).toContain("handoff check");
  });

  it("uses today's date with zero padding for the log path", () => {
    runCli("init");

    expect(promptFor(TODAY)).toContain(".handoff/logs/2026-01-05.md에 저장");
  });

  it("tells the AI to keep an existing log from today", () => {
    runCli("init");
    writeFileSync(join(project.root, ".handoff", "logs", "2026-01-05.md"), "morning work");

    const prompt = promptFor(TODAY);

    expect(prompt).toContain("지우지 말고");
    expect(prompt).toContain("morning work");
  });

  it("does not include a log from another day", () => {
    runCli("init");
    writeFileSync(join(project.root, ".handoff", "logs", "2026-01-04.md"), "yesterday");

    expect(promptFor(TODAY)).not.toContain("yesterday");
  });

  it("does not write any log itself", () => {
    runCli("init");

    promptFor(TODAY);

    expect(() =>
      readFileSync(join(project.root, ".handoff", "logs", "2026-01-05.md"), "utf8"),
    ).toThrow();
  });

  it("asks for init when .handoff is missing", () => {
    const result = runCli("end");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("handoff init");
  });

  it("reports a missing required file", () => {
    runCli("init");
    rmSync(join(project.root, ".handoff", "spec.md"));

    const result = runCli("end");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("spec.md");
    expect(result.stdout).toBe("");
  });
});
