import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const settingsPath = () => join(root, ".claude", "settings.json");
const skillPath = () => join(root, ".claude", "skills", "handoff-end", "SKILL.md");

function writeSettings(content: string) {
  mkdirSync(join(root, ".claude"), { recursive: true });
  writeFileSync(settingsPath(), content);
}

describe("handoff init --claude", () => {
  it("creates .handoff, the start hook and the skill", () => {
    const result = runCli("init", "--claude");

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(root, ".handoff", "spec.md"))).toBe(true);
    expect(JSON.parse(readFileSync(settingsPath(), "utf8"))).toEqual({
      hooks: {
        SessionStart: [
          {
            matcher: "startup|clear|compact",
            hooks: [{ type: "command", command: "handoff start" }],
          },
        ],
      },
    });
    expect(readFileSync(skillPath(), "utf8")).toContain("!`handoff end`");
  });

  it("does not touch Claude Code without the flag", () => {
    runCli("init");

    expect(existsSync(join(root, ".claude"))).toBe(false);
  });

  it("connects a project that already has .handoff, keeping its files", () => {
    runCli("init");
    writeFileSync(join(root, ".handoff", "spec.md"), "my spec");

    const result = runCli("init", "--claude");

    expect(result.exitCode).toBe(0);
    expect(existsSync(settingsPath())).toBe(true);
    expect(readFileSync(join(root, ".handoff", "spec.md"), "utf8")).toBe("my spec");
  });

  it("keeps existing settings and hooks", () => {
    const other = { hooks: [{ type: "command", command: "echo hi" }] };
    writeSettings(
      JSON.stringify({
        model: "opus",
        hooks: { SessionStart: [other], Stop: [other] },
      }),
    );

    runCli("init", "--claude");

    const settings = JSON.parse(readFileSync(settingsPath(), "utf8")) as {
      model: string;
      hooks: { SessionStart: unknown[]; Stop: unknown[] };
    };
    expect(settings.model).toBe("opus");
    expect(settings.hooks.Stop).toEqual([other]);
    expect(settings.hooks.SessionStart).toHaveLength(2);
    expect(settings.hooks.SessionStart[0]).toEqual(other);
  });

  it("is safe to run twice", () => {
    runCli("init", "--claude");
    const before = readFileSync(settingsPath(), "utf8");

    const result = runCli("init", "--claude");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Already connected");
    expect(readFileSync(settingsPath(), "utf8")).toBe(before);
  });

  it("does not overwrite a customized skill", () => {
    runCli("init", "--claude");
    writeFileSync(skillPath(), "my skill");

    runCli("init", "--claude");

    expect(readFileSync(skillPath(), "utf8")).toBe("my skill");
  });

  it.each([
    ["invalid JSON", "{ not json"],
    ["a non-object", "[]"],
    ["invalid hooks", '{"hooks": []}'],
    ["invalid SessionStart", '{"hooks": {"SessionStart": {}}}'],
  ])("leaves settings with %s unchanged", (_name, content) => {
    writeSettings(content);

    const result = runCli("init", "--claude");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Could not connect to Claude Code");
    expect(readFileSync(settingsPath(), "utf8")).toBe(content);
    expect(existsSync(skillPath())).toBe(false);
  });

  it("rejects the flag on other commands", () => {
    runCli("init");

    const result = runCli("start", "--claude");

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
  });
});
