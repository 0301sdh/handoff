import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HANDOFF_DIR } from "./init.js";
import { readLogNames } from "./logs.js";

const REQUIRED_FILES = ["INSTRUCTIONS.md", "spec.md", "rules.md"];

export type StartResult =
  | { status: "not-initialized"; path: string }
  | { status: "missing-file"; path: string }
  | { status: "ready"; context: string };

export function fileBlock(relativePath: string, content: string): string {
  return `<file path="${HANDOFF_DIR}/${relativePath}">\n${content.trimEnd()}\n</file>`;
}

export function readRequiredBlocks(
  root: string,
): { blocks: string[] } | { missing: string } {
  const blocks: string[] = [];
  for (const name of REQUIRED_FILES) {
    const path = join(root, name);
    if (!existsSync(path)) {
      return { missing: path };
    }
    blocks.push(fileBlock(name, readFileSync(path, "utf8")));
  }
  return { blocks };
}

export function buildContext(projectRoot: string): StartResult {
  const root = join(projectRoot, HANDOFF_DIR);
  if (!existsSync(root)) {
    return { status: "not-initialized", path: root };
  }

  const required = readRequiredBlocks(root);
  if ("missing" in required) {
    return { status: "missing-file", path: required.missing };
  }
  const { blocks } = required;

  const { logs } = readLogNames(join(root, "logs"));
  const readLog = (name: string) => readFileSync(join(root, "logs", name), "utf8");
  const latest = logs.at(-1);
  const older = logs.slice(0, -1);

  blocks.push(
    latest === undefined
      ? "No logs yet. This is the first working day."
      : fileBlock(`logs/${latest}`, readLog(latest)),
  );
  if (older.length > 0) {
    const paths = older.map((name) => `- ${HANDOFF_DIR}/logs/${name}`).join("\n");
    blocks.push(`Older logs. Read one only when you need it:\n${paths}`);
  }

  return { status: "ready", context: `${blocks.join("\n\n")}\n` };
}
