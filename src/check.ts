import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HANDOFF_DIR } from "./init.js";

const CRITERIA_HEADING = "완료 조건";
const CRITERIA_CHECK_HEADING = "완료 조건 점검";
const RULES_CHECK_HEADING = "주의사항 점검";
const NEXT_HEADING = "다음 할 일";
const REQUIRED_HEADINGS = [
  "오늘 한 일",
  "결정한 것",
  "주요 대화",
  CRITERIA_CHECK_HEADING,
  RULES_CHECK_HEADING,
  NEXT_HEADING,
];

export type CheckResult =
  | { status: "not-initialized"; path: string }
  | { status: "no-logs"; path: string }
  | { status: "checked"; log: string; problems: string[] };

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseSections(text: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current: string[] | undefined;
  let inFence = false;

  for (const line of text.split(/\r?\n/)) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
    }
    const heading = inFence ? null : /^##\s+(.+?)\s*$/.exec(line);
    const name = heading?.[1];
    if (name !== undefined) {
      current = sections.get(name) ?? [];
      sections.set(name, current);
    } else {
      current?.push(line);
    }
  }
  return sections;
}

function listItems(lines: readonly string[]): string[] {
  return lines.flatMap((line) => {
    const item = /^\s*[-*]\s+(.+?)\s*$/.exec(line)?.[1];
    return item === undefined ? [] : [item];
  });
}

function readCriteria(specPath: string): string[] {
  const lines = parseSections(readFileSync(specPath, "utf8")).get(CRITERIA_HEADING);
  return listItems(lines ?? []).flatMap((item) => {
    const criterion = /^\[[ xX]\]\s+(.+)$/.exec(item)?.[1];
    return criterion === undefined ? [] : [criterion];
  });
}

function readRuleIds(rulesPath: string): string[] {
  return listItems(readFileSync(rulesPath, "utf8").split(/\r?\n/)).flatMap((item) => {
    const id = /^\[(R\d+)\]/.exec(item)?.[1];
    return id === undefined ? [] : [id];
  });
}

function checkLog(root: string, logName: string): string[] {
  const problems: string[] = [];
  const sections = parseSections(readFileSync(join(root, "logs", logName), "utf8"));

  for (const heading of REQUIRED_HEADINGS) {
    if (!sections.has(heading)) {
      problems.push(`Missing heading: ## ${heading}`);
    }
  }

  const specPath = join(root, "spec.md");
  if (existsSync(specPath)) {
    const checked = listItems(sections.get(CRITERIA_CHECK_HEADING) ?? []);
    for (const criterion of readCriteria(specPath)) {
      if (!checked.some((item) => item.startsWith(`${criterion}:`))) {
        problems.push(`Completion criterion not checked: ${criterion}`);
      }
    }
  } else {
    problems.push("Missing file: spec.md");
  }

  const rulesPath = join(root, "rules.md");
  if (existsSync(rulesPath)) {
    const checked = listItems(sections.get(RULES_CHECK_HEADING) ?? []);
    for (const id of readRuleIds(rulesPath)) {
      if (!checked.some((item) => item.startsWith(`${id}:`))) {
        problems.push(`Rule not checked: ${id}`);
      }
    }
  } else {
    problems.push("Missing file: rules.md");
  }

  const next = sections.get(NEXT_HEADING);
  if (next !== undefined && listItems(next).length === 0) {
    problems.push(`Empty section: ## ${NEXT_HEADING}`);
  }

  return problems;
}

export function checkProject(projectRoot: string): CheckResult {
  const root = join(projectRoot, HANDOFF_DIR);
  if (!existsSync(root)) {
    return { status: "not-initialized", path: root };
  }

  const logsPath = join(root, "logs");
  const names = existsSync(logsPath)
    ? readdirSync(logsPath).filter((name) => name.endsWith(".md"))
    : [];
  const logs = names.filter((name) => isValidDate(name.slice(0, -".md".length))).sort();
  const latest = logs.at(-1);
  if (latest === undefined) {
    return { status: "no-logs", path: logsPath };
  }

  const badNames = names
    .filter((name) => !logs.includes(name))
    .map((name) => `Invalid log file name: ${name} (use YYYY-MM-DD.md)`);
  return {
    status: "checked",
    log: join(logsPath, latest),
    problems: [...badNames, ...checkLog(root, latest)],
  };
}
