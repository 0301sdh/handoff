import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../src/cli.js";

const SPEC = `# 게시판

## 목표
게시판을 만든다.

## 완료 조건
- [x] 로그인할 수 있다
- [ ] 글을 작성할 수 있다

## 변경 기록
`;

const RULES = `# 주의사항

- [R1] any를 쓰지 않는다
- [R2] 비밀 값을 커밋하지 않는다
`;

const VALID_LOG = `# 2026-11-03

## 오늘 한 일
- 로그인 API 구현

## 결정한 것
- JWT 사용: 서버를 단순하게 유지하려고

## 주요 대화
- Q: 토큰을 어디에 저장할까?
- A: httpOnly 쿠키

## 완료 조건 점검
- 로그인할 수 있다: 완료 (테스트 통과)
- 글을 작성할 수 있다: 미완료

## 주의사항 점검
- R1: 통과
- R2: 통과

## 다음 할 일
- 글 작성 API 구현
`;

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

function setUp() {
  runCli("init");
  writeFileSync(join(root, ".handoff", "spec.md"), SPEC);
  writeFileSync(join(root, ".handoff", "rules.md"), RULES);
}

function writeLog(name: string, content: string) {
  writeFileSync(join(root, ".handoff", "logs", name), content);
}

describe("handoff check", () => {
  it("passes a complete log", () => {
    setUp();
    writeLog("2026-11-03.md", VALID_LOG);

    const result = runCli("check");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("OK:");
  });

  it("asks for init when .handoff is missing", () => {
    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("handoff init");
  });

  it("reports when there is no log", () => {
    setUp();

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No log found");
  });

  it("reports a missing heading", () => {
    setUp();
    writeLog("2026-11-03.md", VALID_LOG.replace("## 결정한 것", "## 결정"));

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing heading: ## 결정한 것");
  });

  it("reports an unchecked completion criterion", () => {
    setUp();
    writeLog("2026-11-03.md", VALID_LOG.replace("- 글을 작성할 수 있다: 미완료\n", ""));

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Completion criterion not checked: 글을 작성할 수 있다");
    expect(result.stderr).not.toContain("not checked: 로그인할 수 있다");
  });

  it("reports an unchecked rule", () => {
    setUp();
    writeLog("2026-11-03.md", VALID_LOG.replace("- R2: 통과\n", ""));

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Rule not checked: R2");
  });

  it("does not treat R1 as R10", () => {
    setUp();
    writeFileSync(join(root, ".handoff", "rules.md"), "- [R1] 하나\n- [R10] 열\n");
    writeLog("2026-11-03.md", VALID_LOG.replace("- R1: 통과", "- R10: 통과"));

    const result = runCli("check");

    expect(result.stderr).toContain("Rule not checked: R1\n");
  });

  it("reports an empty next-step section", () => {
    setUp();
    writeLog("2026-11-03.md", VALID_LOG.replace("- 글 작성 API 구현\n", ""));

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Empty section: ## 다음 할 일");
  });

  it("checks only the latest log", () => {
    setUp();
    writeLog("2026-11-02.md", "broken");
    writeLog("2026-11-03.md", VALID_LOG);

    const result = runCli("check");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("2026-11-03.md");
  });

  it.each(["notes.md", "2026-02-30.md", "2026-13-01.md"])(
    "reports the invalid log file name %s",
    (name) => {
      setUp();
      writeLog("2026-11-03.md", VALID_LOG);
      writeLog(name, VALID_LOG);

      const result = runCli("check");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(`Invalid log file name: ${name}`);
    },
  );

  it("ignores headings inside code blocks", () => {
    setUp();
    const log = VALID_LOG.replace(
      "## 다음 할 일\n- 글 작성 API 구현\n",
      "```\n## 다음 할 일\n- 글 작성 API 구현\n```\n",
    );
    writeLog("2026-11-03.md", log);

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing heading: ## 다음 할 일");
  });

  it("handles Windows line endings", () => {
    setUp();
    writeFileSync(join(root, ".handoff", "spec.md"), SPEC.replaceAll("\n", "\r\n"));
    writeFileSync(join(root, ".handoff", "rules.md"), RULES.replaceAll("\n", "\r\n"));
    writeLog("2026-11-03.md", VALID_LOG.replaceAll("\n", "\r\n"));

    expect(runCli("check").exitCode).toBe(0);
  });
});

describe("handoff check with reference documents", () => {
  const specWithDocs = SPEC.replace(
    "## 변경 기록",
    "## 참고 문서\n- [D1] api.md: API를 만들 때\n- [D2] https://figma.com/file/abc: 화면을 만들 때\n\n## 변경 기록",
  );
  const docsCheck = "## 참고 문서 점검\n- D1: 일치 (POST /posts 확인)\n- D2: 해당 없음\n\n## 다음 할 일";

  function setUpWithDocs() {
    setUp();
    writeFileSync(join(root, ".handoff", "spec.md"), specWithDocs);
    writeFileSync(join(root, "api.md"), "# API");
  }

  it("passes when every document is checked", () => {
    setUpWithDocs();
    writeLog("2026-11-03.md", VALID_LOG.replace("## 다음 할 일", docsCheck));

    expect(runCli("check").exitCode).toBe(0);
  });

  it("requires the heading only when there are documents", () => {
    setUpWithDocs();
    writeLog("2026-11-03.md", VALID_LOG);

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing heading: ## 참고 문서 점검");
  });

  it("reports an unchecked document", () => {
    setUpWithDocs();
    writeLog(
      "2026-11-03.md",
      VALID_LOG.replace("## 다음 할 일", docsCheck).replace("- D2: 해당 없음\n", ""),
    );

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Reference document not checked: D2");
  });

  it("reports a missing local file but not a link", () => {
    setUpWithDocs();
    rmSync(join(root, "api.md"));
    writeLog("2026-11-03.md", VALID_LOG.replace("## 다음 할 일", docsCheck));

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Reference document not found: D1 api.md");
    expect(result.stderr).not.toContain("D2 https");
  });

  it("reports a document without a reading condition", () => {
    setUp();
    writeFileSync(
      join(root, ".handoff", "spec.md"),
      SPEC.replace("## 변경 기록", "## 참고 문서\n- [D1] api.md\n\n## 변경 기록"),
    );
    writeLog("2026-11-03.md", VALID_LOG);

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Reference document D1 in spec.md needs");
  });

  it("ignores the example in the template", () => {
    runCli("init");
    writeFileSync(join(root, ".handoff", "rules.md"), RULES);
    writeLog(
      "2026-11-03.md",
      VALID_LOG.replace(
        "- 로그인할 수 있다: 완료 (테스트 통과)\n- 글을 작성할 수 있다: 미완료",
        "- 첫 번째 완료 조건: 미완료",
      ),
    );

    const result = runCli("check");

    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });
});
