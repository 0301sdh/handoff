import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HANDOFF_DIR } from "./init.js";
import { readLogNames } from "./logs.js";

const REQUIRED_FILES = ["INSTRUCTIONS.md", "spec.md", "rules.md"];

export type StartResult =
  | { status: "not-initialized"; path: string }
  | { status: "missing-file"; path: string }
  | { status: "ready"; context: string; tokens: number; tokensWithAllLogs: number };

// A rough estimate: about 4 characters per token for ASCII, 1.5 for others such as Korean.
export function estimateTokens(text: string): number {
  let ascii = 0;
  let other = 0;
  for (const char of text) {
    if (char.charCodeAt(0) < 128) {
      ascii += 1;
    } else {
      other += 1;
    }
  }
  return Math.ceil(ascii / 4 + other / 1.5);
}

function fileBlock(relativePath: string, content: string): string {
  return `<file path="${HANDOFF_DIR}/${relativePath}">\n${content.trimEnd()}\n</file>`;
}

export function buildContext(projectRoot: string): StartResult {
  const root = join(projectRoot, HANDOFF_DIR);
  if (!existsSync(root)) {
    return { status: "not-initialized", path: root };
  }

  const blocks: string[] = [];
  for (const name of REQUIRED_FILES) {
    const path = join(root, name);
    if (!existsSync(path)) {
      return { status: "missing-file", path };
    }
    blocks.push(fileBlock(name, readFileSync(path, "utf8")));
  }

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

  const context = `${blocks.join("\n\n")}\n`;
  const olderText = older.map(readLog).join("");
  return {
    status: "ready",
    context,
    tokens: estimateTokens(context),
    tokensWithAllLogs: estimateTokens(context + olderText),
  };
}
