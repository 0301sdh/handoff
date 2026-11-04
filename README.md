# handoff

[![CI](https://github.com/0301sdh/handoff/actions/workflows/ci.yml/badge.svg)](https://github.com/0301sdh/handoff/actions/workflows/ci.yml)

여러 날에 걸친 AI 코딩 작업에서 **AI가 목표, 주의사항, 지난 작업을 잊지 않게** 해 주는 TypeScript CLI입니다.
Claude Code, Codex, GitHub Copilot CLI에 연결할 수 있습니다.

## 해결하려는 문제

- 새 세션을 열면 AI는 이전 대화를 기억하지 못합니다. 그래서 매번 목표와 진행 상황을 다시 설명해야 합니다.
- 작업이 길어지면 AI가 처음 정한 목표나 주의사항에서 벗어납니다.
- 하루 작업을 정리하지 않으면, 다음 날 무엇을 왜 결정했는지 알 수 없습니다.

## 동작 방식

1. 목표, 완료 조건, 주의사항을 `.handoff/`에 파일로 적어 둡니다.
2. 새 세션이 열리면 AI 도구의 훅이 `handoff start`를 실행해 그 내용을 AI에게 자동으로 전달합니다.
3. 작업을 마칠 때 `handoff-end` 스킬을 부르면, AI가 오늘 작업을 완료 조건과 주의사항에 하나씩 대조하고 날짜별 기록으로 남깁니다.
4. AI가 `handoff check`를 실행해 기록에 빠진 항목이 없는지 검사하고, 문제가 있으면 고칩니다.
5. 다음 날 새 세션에는 **가장 최근 기록만** 전달하고, 이전 기록은 경로만 알려 줘서 필요할 때 읽게 합니다.

파일을 찾고 형식을 검사하는 일은 프로그램이, 요약하고 판단하는 일은 AI가 맡습니다.
프로그램은 같은 입력에 항상 같은 결과를 내지만, AI의 결과는 매번 달라질 수 있기 때문입니다.

## 설치

Node.js 22 이상이 필요합니다. 아직 npm에 배포하지 않았으므로 저장소에서 빌드해 설치합니다.

```bash
git clone https://github.com/0301sdh/handoff.git
cd handoff
npm ci
npm run build
npm link
```

`npm link`가 `handoff` 명령을 전역에 연결합니다. 지우려면 `npm uninstall -g handoff`를 실행합니다.

## 빠른 시작

작업할 프로젝트 폴더에서 실행합니다.

```bash
handoff init --agent claude
```

1. `.handoff/spec.md`에 목표와 완료 조건을, `.handoff/rules.md`에 주의사항을 적습니다.
2. AI 도구에서 새 세션을 엽니다. `.handoff/`의 내용이 자동으로 전달됩니다.
3. 작업을 마칠 때 `handoff-end` 스킬을 부릅니다. Claude Code와 Copilot에서는 `/handoff-end`, Codex에서는 `$handoff-end`입니다.

## 명령어

| 명령어 | 하는 일 |
|---|---|
| `handoff init` | `.handoff/` 폴더와 기본 파일을 만듭니다. 이미 있으면 아무것도 바꾸지 않습니다 |
| `handoff init --agent <이름>` | AI 도구에 세션 시작 훅과 `handoff-end` 스킬을 설치합니다. 여러 번 써서 함께 연결할 수 있습니다 |
| `handoff start` | AI에게 줄 맥락을 출력합니다 |
| `handoff start --json` | 맥락을 `{"additionalContext": "..."}` 형식으로 출력합니다. Copilot 훅이 사용합니다 |
| `handoff end` | AI에게 줄 마무리 지시를 출력합니다. 기록은 AI가 직접 씁니다 |
| `handoff check` | 가장 최근 기록에 빠진 항목이 없는지 검사합니다 |

종료 코드는 `0` 성공, `1` 문제 발견, `2` 잘못된 사용법입니다.

## AI 도구 연결

```bash
handoff init --agent claude --agent codex --agent copilot
```

| 이름 | 세션 시작 훅 | 마무리 스킬 | 참고 |
|---|---|---|---|
| `claude` | `.claude/settings.json` | `.claude/skills/handoff-end/SKILL.md` | 스킬을 부르면 `handoff end` 결과가 바로 전달됩니다 |
| `codex` | `.codex/hooks.json` | `.agents/skills/handoff-end/SKILL.md` | 처음 한 번 Codex에서 `/hooks`로 훅을 신뢰해야 합니다 |
| `copilot` | `.github/hooks/handoff.json` | `.agents/skills/handoff-end/SKILL.md` | 이어서 하는 세션에서도 맥락을 다시 전달합니다 |

- 기존 설정과 다른 훅은 그대로 두고 handoff 훅만 추가합니다.
- 여러 번 실행해도 훅이 중복되지 않고, 사용자가 고친 스킬과 훅 파일은 덮어쓰지 않습니다.
- 설정 파일 하나라도 올바른 JSON이 아니면 **어떤 파일도 바꾸지 않고** 멈춥니다.

## 만들어지는 파일

```text
.handoff/
├── spec.md          # 목표, 완료 조건, 범위 밖, 참고 문서, 변경 기록
├── rules.md         # 주의사항: [R1], [R2]처럼 번호를 붙입니다
├── INSTRUCTIONS.md  # AI가 따를 작업 순서와 기록 형식
└── logs/
    └── 2026-11-04.md   # 날짜별 작업 기록
```

### 참고 문서

API 명세, 화면 설계처럼 작업할 때 따라야 할 문서를 `spec.md`에 "언제 읽을지"와 함께 등록할 수 있습니다.

```markdown
## 참고 문서
- [D1] docs/api.md: API를 만들거나 고칠 때
- [D2] https://figma.com/...: 화면을 만들 때
```

AI는 해당 작업을 할 때만 문서를 읽고, 마무리할 때 구현과 대조합니다. `handoff check`는 로컬 문서가 실제로 있는지도 확인합니다.

### 날짜별 기록

`handoff check`는 가장 최근 기록에서 다음을 검사합니다.

- `오늘 한 일`, `결정한 것`, `주요 대화`, `완료 조건 점검`, `주의사항 점검`, `다음 할 일` 제목이 모두 있는지
- `spec.md`의 모든 완료 조건과 `rules.md`의 모든 주의사항을 점검했는지
- 참고 문서가 있으면 `참고 문서 점검`에서 모든 문서를 점검했는지
- `다음 할 일`이 비어 있지 않은지
- 기록 파일 이름이 `YYYY-MM-DD.md` 형식인지


## 개발

```bash
npm ci
npm run typecheck   # 타입 검사
npm run lint        # 린트
npm run build       # dist/에 빌드
npm test            # 테스트
```

GitHub Actions가 push와 pull request마다 Node 22와 24에서 위 네 가지를 실행합니다.

| 파일 | 역할 |
|---|---|
| `src/bin.ts` | 실행 파일의 입구 |
| `src/cli.ts` | 옵션 해석, 사용법 검사, 결과 출력 |
| `src/init.ts` | `.handoff/` 만들기 |
| `src/agents.ts` | AI 도구별 훅과 스킬 설치 |
| `src/start.ts` | 맥락 만들기 |
| `src/end.ts` | 마무리 지시 만들기 |
| `src/check.ts` | 기록 검사 |
| `src/logs.ts` | 기록 파일 이름 검사 |

명령마다 결과 객체만 돌려주고, 화면 출력은 `cli.ts`에서만 합니다. 그래서 테스트에서 결과를 바로 비교할 수 있습니다.

## 라이선스

[MIT](LICENSE)
