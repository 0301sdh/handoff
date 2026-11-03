import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const AGENTS = ["claude", "codex", "copilot"] as const;
export type Agent = (typeof AGENTS)[number];

export const AGENT_NAMES: Record<Agent, string> = {
  claude: "Claude Code",
  codex: "Codex",
  copilot: "Copilot CLI",
};

const START_COMMAND = "handoff start";
// Copilot reads hook output only as JSON.
const START_JSON_COMMAND = "handoff start --json";
// "resume" is left out because a resumed session already has its context.
const START_MATCHER = "startup|clear|compact";

const SKILL_DESCRIPTION =
  "오늘 작업을 Spec, 주의사항과 대조하고 날짜별 기록으로 저장한다. 사용자가 오늘 작업을 마무리하라고 할 때 사용한다.";

// Claude Code runs the command before the model reads the skill.
const CLAUDE_SKILL = `---
description: ${SKILL_DESCRIPTION}
allowed-tools: Bash(handoff end) Bash(handoff check)
---

!\`handoff end\`
`;

// Codex and Copilot both read .agents/skills, but cannot run a command inside a skill.
const SHARED_SKILL = `---
name: handoff-end
description: ${SKILL_DESCRIPTION}
---

"handoff end"를 실행하고, 출력된 지시를 순서대로 따른다.
`;

const COPILOT_HOOKS = {
  version: 1,
  hooks: {
    sessionStart: [{ type: "command", bash: START_JSON_COMMAND, powershell: START_JSON_COMMAND }],
  },
};

export function isAgent(name: string): name is Agent {
  return (AGENTS as readonly string[]).includes(name);
}

interface PlannedWrite {
  path: string;
  content: string;
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

function readJsonObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    return {};
  }
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`${path} is not valid JSON. Fix it and try again.`);
  }
  if (!isRecord(value)) {
    throw new Error(`${path} must contain a JSON object. Fix it and try again.`);
  }
  return value;
}

// Claude Code and Codex share the same SessionStart format.
function planStartHook(path: string): PlannedWrite | undefined {
  const settings = readJsonObject(path);
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
  const updated = {
    ...settings,
    hooks: {
      ...hooks,
      SessionStart: [
        ...groups,
        { matcher: START_MATCHER, hooks: [{ type: "command", command: START_COMMAND }] },
      ],
    },
  };
  return { path, content: `${JSON.stringify(updated, null, 2)}\n` };
}

// Creates a file only when it is missing, so user edits are kept.
function planNewFile(path: string, content: string): PlannedWrite | undefined {
  return existsSync(path) ? undefined : { path, content };
}

function planAgent(projectRoot: string, agent: Agent): (PlannedWrite | undefined)[] {
  const sharedSkill = join(projectRoot, ".agents", "skills", "handoff-end", "SKILL.md");
  switch (agent) {
    case "claude":
      return [
        planStartHook(join(projectRoot, ".claude", "settings.json")),
        planNewFile(join(projectRoot, ".claude", "skills", "handoff-end", "SKILL.md"), CLAUDE_SKILL),
      ];
    case "codex":
      return [
        planStartHook(join(projectRoot, ".codex", "hooks.json")),
        planNewFile(sharedSkill, SHARED_SKILL),
      ];
    case "copilot":
      return [
        planNewFile(
          join(projectRoot, ".github", "hooks", "handoff.json"),
          `${JSON.stringify(COPILOT_HOOKS, null, 2)}\n`,
        ),
        planNewFile(sharedSkill, SHARED_SKILL),
      ];
  }
}

// Returns the paths it wrote. Every file is checked first, so a bad file leaves the project unchanged.
export function connectAgents(projectRoot: string, agents: readonly Agent[]): string[] {
  const writes = new Map<string, string>();
  for (const agent of agents) {
    for (const write of planAgent(projectRoot, agent)) {
      if (write !== undefined) {
        writes.set(write.path, write.content);
      }
    }
  }
  for (const [path, content] of writes) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return [...writes.keys()];
}
