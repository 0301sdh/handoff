import { describe, expect, it } from "vitest";
import { runCli } from "./helpers.js";

describe("run", () => {
  it("shows help with --help", () => {
    const result = runCli("--help");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
  });

  it("shows help with no arguments", () => {
    expect(runCli().stdout).toContain("Usage:");
  });

  it("shows the version with --version", () => {
    const result = runCli("--version");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  it("points to --help on an unknown option", () => {
    const result = runCli("--nope");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--help");
  });

  it("points to --help on an unknown command", () => {
    const result = runCli("nope");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unknown command: nope");
  });
});
