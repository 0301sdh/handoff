import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const HANDOFF_DIR = ".handoff";

const SPEC_TEMPLATE = `# 프로젝트 이름

## 목표
무엇을 왜 만드는지 적는다.

## 완료 조건
- [ ] 첫 번째 완료 조건

## 범위 밖
- 이번에 만들지 않을 것

## 참고 문서
<!-- 작업할 때 따라야 할 문서를 "경로나 링크: 언제 읽을지" 형식으로 적는다. 예:
- [D1] docs/api.md: API를 만들거나 고칠 때
- [D2] https://figma.com/...: 화면을 만들 때
-->

## 변경 기록
`;

const RULES_TEMPLATE = `# 주의사항

- [R1] 첫 번째 주의사항
`;

const INSTRUCTIONS_TEMPLATE = `# AI 작업 지침

## 작업을 시작할 때
1. spec.md와 rules.md를 읽는다.
2. logs/에서 가장 최근 기록을 읽는다.
3. 오늘 할 일을 사용자에게 한 줄로 확인한다.
4. 이전 결정이 필요할 때만 더 오래된 기록을 읽는다.
5. spec.md의 참고 문서는 적힌 때에 해당하는 작업을 할 때 읽고 그대로 따른다.

## 작업을 마칠 때
1. 오늘 작업을 spec.md의 완료 조건, rules.md의 주의사항, spec.md의 참고 문서에 하나씩 대조한다.
2. 대화 전체를 옮기지 말고 핵심만 요약해 logs/YYYY-MM-DD.md에 저장한다.
3. 끝난 완료 조건은 spec.md에서 체크한다.
4. 목표나 완료 조건이 바뀌었다면 날짜와 이유를 spec.md의 변경 기록에 남긴다.
5. "handoff check"를 실행해 문제가 없을 때까지 고친다.

## 기록 형식
아래 제목을 모두 그대로 쓴다. "참고 문서 점검"은 spec.md에 참고 문서가 있을 때만 쓴다.

\`\`\`markdown
# YYYY-MM-DD

## 오늘 한 일
- 한 일

## 결정한 것
- 결정: 이유

## 주요 대화
- Q: 질문
- A: 답변

## 완료 조건 점검
- 완료 조건: 완료 또는 미완료 (근거)

## 주의사항 점검
- R1: 통과 또는 위반 (근거)

## 참고 문서 점검
- D1: 일치, 불일치 또는 해당 없음 (근거)

## 다음 할 일
- 다음에 할 일
\`\`\`
`;

export type InitResult =
  | { status: "created"; path: string }
  | { status: "exists"; path: string };

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

export function initProject(root: string): InitResult {
  const path = join(root, HANDOFF_DIR);

  try {
    mkdirSync(path);
  } catch (error) {
    if (isAlreadyExists(error)) {
      return { status: "exists", path };
    }
    throw error;
  }

  writeFileSync(join(path, "spec.md"), SPEC_TEMPLATE);
  writeFileSync(join(path, "rules.md"), RULES_TEMPLATE);
  writeFileSync(join(path, "INSTRUCTIONS.md"), INSTRUCTIONS_TEMPLATE);
  mkdirSync(join(path, "logs"));
  writeFileSync(join(path, "logs", ".gitkeep"), "");

  return { status: "created", path };
}
