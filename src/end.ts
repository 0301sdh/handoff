import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HANDOFF_DIR } from "./init.js";
import { fileBlock, readRequiredBlocks } from "./start.js";

export type EndResult =
  | { status: "not-initialized"; path: string }
  | { status: "missing-file"; path: string }
  | { status: "ready"; prompt: string };

function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${String(date.getFullYear())}-${month}-${day}`;
}

export function buildEndPrompt(projectRoot: string, today: Date = new Date()): EndResult {
  const root = join(projectRoot, HANDOFF_DIR);
  if (!existsSync(root)) {
    return { status: "not-initialized", path: root };
  }

  const required = readRequiredBlocks(root);
  if ("missing" in required) {
    return { status: "missing-file", path: required.missing };
  }

  const logName = `${formatLocalDate(today)}.md`;
  const logRelativePath = `logs/${logName}`;
  const logPath = join(root, "logs", logName);
  const logExists = existsSync(logPath);

  const steps = [
    "오늘 작업을 마무리한다. 아래 순서를 그대로 따른다.",
    "",
    "1. 실제 코드와 변경 내역을 확인해 spec.md의 완료 조건, rules.md의 주의사항, spec.md의 참고 문서에 하나씩 대조한다. 참고 문서는 오늘 작업과 관련된 것을 실제로 열어 보고, 관련 없으면 \"해당 없음\"으로 적는다. 확인하지 못한 항목은 통과로 적지 않는다.",
    logExists
      ? `2. 오늘 기록이 이미 있다. ${HANDOFF_DIR}/${logRelativePath}의 기존 내용을 지우지 말고 이어서 고친다.`
      : `2. 오늘 대화의 핵심을 INSTRUCTIONS.md의 기록 형식으로 요약해 ${HANDOFF_DIR}/${logRelativePath}에 저장한다.`,
    '   실제로 없었던 대화나 결정은 지어내지 말고 "없음"으로 적는다.',
    "3. 끝난 완료 조건은 spec.md에서 체크하고, 목표나 완료 조건이 바뀌었다면 날짜와 이유를 변경 기록에 남긴다.",
    '4. "handoff check"를 실행해 문제가 없을 때까지 고친다.',
    "5. 위반했거나 끝나지 않은 항목과 다음 할 일을 사용자에게 알린다.",
  ];

  const blocks = [steps.join("\n"), ...required.blocks];
  if (logExists) {
    blocks.push(fileBlock(logRelativePath, readFileSync(logPath, "utf8")));
  }
  return { status: "ready", prompt: `${blocks.join("\n\n")}\n` };
}
