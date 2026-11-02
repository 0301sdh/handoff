import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { HANDOFF_DIR, initProject } from "./init.js";

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const HELP = `handoff: keep multi-day AI coding work on track

Usage:
  handoff <command> [options]

Commands:
  init           Create ${HANDOFF_DIR}/ in the current directory

Options:
  -h, --help     Show this help
  -v, --version  Show the version
`;

function readVersion(): string {
  const packageJson: unknown = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  if (
    typeof packageJson === "object" &&
    packageJson !== null &&
    "version" in packageJson &&
    typeof packageJson.version === "string"
  ) {
    return packageJson.version;
  }
  throw new Error("package.json has no version");
}

function parse(argv: readonly string[]) {
  return parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
}

function runInit(root: string, io: Io): number {
  let result: ReturnType<typeof initProject>;
  try {
    result = initProject(root);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`Could not create ${HANDOFF_DIR}/: ${message}\n`);
    return 1;
  }

  if (result.status === "exists") {
    io.stderr(
      `${result.path} already exists, so nothing was changed.\nEdit its files directly, or remove it and run "handoff init" again.\n`,
    );
    return 1;
  }

  io.stdout(
    `Created ${result.path}\nNext: write your goal and completion criteria in ${HANDOFF_DIR}/spec.md, then your rules in ${HANDOFF_DIR}/rules.md.\n`,
  );
  return 0;
}

export function run(
  argv: readonly string[],
  io: Io,
  root: string = process.cwd(),
): number {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message}\nRun "handoff --help" to see the options.\n`);
    return 2;
  }

  if (parsed.values.help === true) {
    io.stdout(HELP);
    return 0;
  }

  if (parsed.values.version === true) {
    io.stdout(`${readVersion()}\n`);
    return 0;
  }

  const [command, ...extra] = parsed.positionals;
  if (command === undefined) {
    io.stdout(HELP);
    return 0;
  }

  if (command !== "init") {
    io.stderr(
      `Unknown command: ${command}\nRun "handoff --help" to see the options.\n`,
    );
    return 2;
  }

  if (extra.length > 0) {
    io.stderr(
      `"handoff init" takes no arguments, but got: ${extra.join(" ")}\nRun it inside the project directory.\n`,
    );
    return 2;
  }

  return runInit(root, io);
}
