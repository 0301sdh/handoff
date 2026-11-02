import { existsSync, readdirSync } from "node:fs";

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

export function readLogNames(logsPath: string): { logs: string[]; badNames: string[] } {
  const names = existsSync(logsPath)
    ? readdirSync(logsPath).filter((name) => name.endsWith(".md"))
    : [];
  const logs = names.filter((name) => isValidDate(name.slice(0, -".md".length))).sort();
  return { logs, badNames: names.filter((name) => !logs.includes(name)) };
}
