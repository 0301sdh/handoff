import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { project, runCli } from "./helpers.js";

const settingsPath = () => join(project.root, ".claude", "settings.json");
const skillPath = () => join(project.root, ".claude", "skills", "handoff-end", "SKILL.md");

function writeSettings(content: string) {
  mkdirSync(join(project.root, ".claude"), { recursive: true });
  writeFileSync(settingsPath(), content);
}

describe("handoff init --agent claude", () => {
  it("creates .handoff, the start hook and the skill", () => {
    const result = runCli("init", "--agent", "claude");

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(project.root, ".handoff", "spec.md"))).toBe(true);
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

    expect(existsSync(join(project.root, ".claude"))).toBe(false);
  });

  it("connects a project that already has .handoff, keeping its files", () => {
    runCli("init");
    writeFileSync(join(project.root, ".handoff", "spec.md"), "my spec");

    const result = runCli("init", "--agent", "claude");

    expect(result.exitCode).toBe(0);
    expect(existsSync(settingsPath())).toBe(true);
    expect(readFileSync(join(project.root, ".handoff", "spec.md"), "utf8")).toBe("my spec");
  });

  it("keeps existing settings and hooks", () => {
    const other = { hooks: [{ type: "command", command: "echo hi" }] };
    writeSettings(
      JSON.stringify({
        model: "opus",
        hooks: { SessionStart: [other], Stop: [other] },
      }),
    );

    runCli("init", "--agent", "claude");

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
    runCli("init", "--agent", "claude");
    const before = readFileSync(settingsPath(), "utf8");

    const result = runCli("init", "--agent", "claude");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Already connected");
    expect(readFileSync(settingsPath(), "utf8")).toBe(before);
  });

  it("does not overwrite a customized skill", () => {
    runCli("init", "--agent", "claude");
    writeFileSync(skillPath(), "my skill");

    runCli("init", "--agent", "claude");

    expect(readFileSync(skillPath(), "utf8")).toBe("my skill");
  });

  it.each([
    ["invalid JSON", "{ not json"],
    ["a non-object", "[]"],
    ["invalid hooks", '{"hooks": []}'],
    ["invalid SessionStart", '{"hooks": {"SessionStart": {}}}'],
  ])("leaves settings with %s unchanged", (_name, content) => {
    writeSettings(content);

    const result = runCli("init", "--agent", "claude");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Could not connect to Claude Code");
    expect(readFileSync(settingsPath(), "utf8")).toBe(content);
    expect(existsSync(skillPath())).toBe(false);
  });

});

const codexHooksPath = () => join(project.root, ".codex", "hooks.json");
const copilotHooksPath = () => join(project.root, ".github", "hooks", "handoff.json");
const sharedSkillPath = () => join(project.root, ".agents", "skills", "handoff-end", "SKILL.md");

describe("handoff init --agent codex", () => {
  it("adds the start hook and the shared skill", () => {
    const result = runCli("init", "--agent", "codex");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("/hooks");
    expect(JSON.parse(readFileSync(codexHooksPath(), "utf8"))).toEqual({
      hooks: {
        SessionStart: [
          {
            matcher: "startup|clear|compact",
            hooks: [{ type: "command", command: "handoff start" }],
          },
        ],
      },
    });
    const skill = readFileSync(sharedSkillPath(), "utf8");
    expect(skill).toContain("name: handoff-end");
    expect(skill).toContain("handoff end");
  });

  it("keeps other Codex hooks", () => {
    const other = { hooks: [{ type: "command", command: "echo hi" }] };
    mkdirSync(join(project.root, ".codex"), { recursive: true });
    writeFileSync(codexHooksPath(), JSON.stringify({ hooks: { Stop: [other] } }));

    runCli("init", "--agent", "codex");

    const hooks = JSON.parse(readFileSync(codexHooksPath(), "utf8")) as {
      hooks: { Stop: unknown[]; SessionStart: unknown[] };
    };
    expect(hooks.hooks.Stop).toEqual([other]);
    expect(hooks.hooks.SessionStart).toHaveLength(1);
  });
});

describe("handoff init --agent copilot", () => {
  it("adds a JSON start hook and the shared skill", () => {
    const result = runCli("init", "--agent", "copilot");

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(readFileSync(copilotHooksPath(), "utf8"))).toEqual({
      version: 1,
      hooks: {
        sessionStart: [
          {
            type: "command",
            bash: "handoff start --json",
            powershell: "handoff start --json",
          },
        ],
      },
    });
    expect(existsSync(sharedSkillPath())).toBe(true);
  });

  it("does not overwrite an edited hook file", () => {
    mkdirSync(join(project.root, ".github", "hooks"), { recursive: true });
    writeFileSync(copilotHooksPath(), "my hooks");

    runCli("init", "--agent", "copilot");

    expect(readFileSync(copilotHooksPath(), "utf8")).toBe("my hooks");
  });
});

describe("handoff init with several agents", () => {
  it("connects every agent and writes the shared skill once", () => {
    const result = runCli("init", "--agent", "codex", "--agent", "copilot", "--agent", "claude");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Codex, Copilot CLI, Claude Code");
    expect(result.stdout.match(/\.agents\/skills/g)).toHaveLength(1);
    expect(existsSync(settingsPath())).toBe(true);
    expect(existsSync(codexHooksPath())).toBe(true);
    expect(existsSync(copilotHooksPath())).toBe(true);
  });

  it("writes nothing when one agent's file is broken", () => {
    writeSettings("{ not json");

    const result = runCli("init", "--agent", "copilot", "--agent", "claude");

    expect(result.exitCode).toBe(1);
    expect(existsSync(copilotHooksPath())).toBe(false);
    expect(existsSync(sharedSkillPath())).toBe(false);
  });

  it("rejects an unknown agent", () => {
    const result = runCli("init", "--agent", "cursor");

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unknown agent: cursor");
    expect(existsSync(join(project.root, ".handoff"))).toBe(false);
  });

  it("rejects --agent on other commands", () => {
    runCli("init");

    const result = runCli("start", "--agent", "claude");

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
  });
});
