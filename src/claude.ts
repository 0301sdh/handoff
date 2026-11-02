import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const START_COMMAND = "handoff start";
// "resume" is left out because a resumed session already has its context.
const START_MATCHER = "startup|clear|compact";

const SKILL_TEMPLATE = `---
description: 오늘 작업을 Spec, 주의사항과 대조하고 날짜별 기록으로 저장한다. 사용자가 오늘 작업을 마무리하라고 할 때 사용한다.
allowed-tools: Bash(handoff end) Bash(handoff check)
---

!\`handoff end\`
`;

export interface ClaudeInstallResult {
  hookAdded: boolean;
  skillAdded: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStartHook(groups: readonly unknown[]): boolean {
  return groups.some(
    (group) =>
      isRecord(group) &&
      Array.isArray(group.hooks) &&
      group.hooks.some((hook) => isRecord(hook) && hook.command === START_COMMAND),
  );
}

function readSettings(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    return {};
  }
  let settings: unknown;
  try {
    settings = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`${path} is not valid JSON. Fix it and try again.`);
  }
  if (!isRecord(settings)) {
    throw new Error(`${path} must contain a JSON object. Fix it and try again.`);
  }
  return settings;
}

function withStartHook(
  settings: Record<string, unknown>,
  path: string,
): Record<string, unknown> | undefined {
  const hooks = settings.hooks ?? {};
  if (!isRecord(hooks)) {
    throw new Error(`"hooks" in ${path} must be an object. Fix it and try again.`);
  }
  const sessionStart = hooks.SessionStart ?? [];
  if (!Array.isArray(sessionStart)) {
    throw new Error(
      `"hooks.SessionStart" in ${path} must be an array. Fix it and try again.`,
    );
  }
  const groups: readonly unknown[] = sessionStart;
  if (hasStartHook(groups)) {
    return undefined;
  }
  return {
    ...settings,
    hooks: {
      ...hooks,
      SessionStart: [
        ...groups,
        {
          matcher: START_MATCHER,
          hooks: [{ type: "command", command: START_COMMAND }],
        },
      ],
    },
  };
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function installClaude(projectRoot: string): ClaudeInstallResult {
  const settingsPath = join(projectRoot, ".claude", "settings.json");
  const skillPath = join(projectRoot, ".claude", "skills", "handoff-end", "SKILL.md");

  // Validate the settings first so a bad file leaves the project unchanged.
  const updatedSettings = withStartHook(readSettings(settingsPath), settingsPath);

  const skillAdded = !existsSync(skillPath);
  if (skillAdded) {
    writeFile(skillPath, SKILL_TEMPLATE);
  }
  if (updatedSettings !== undefined) {
    writeFile(settingsPath, `${JSON.stringify(updatedSettings, null, 2)}\n`);
  }
  return { hookAdded: updatedSettings !== undefined, skillAdded };
}
