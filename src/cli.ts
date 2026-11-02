import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const HELP = `handoff: keep multi-day AI coding work on track

Usage:
  handoff [options]

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

export function run(argv: readonly string[], io: Io): number {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message}\nRun "handoff --help" to see the options.\n`);
    return 2;
  }

  const [command] = parsed.positionals;
  if (command !== undefined) {
    io.stderr(
      `Unknown command: ${command}\nRun "handoff --help" to see the options.\n`,
    );
    return 2;
  }

  if (parsed.values.version === true) {
    io.stdout(`${readVersion()}\n`);
    return 0;
  }

  io.stdout(HELP);
  return 0;
}
