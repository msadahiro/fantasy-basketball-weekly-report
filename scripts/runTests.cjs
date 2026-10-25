const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

function discover(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return discover(path);
    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      return [path];
    }

    return [];
  });
}

const files = discover("src").sort();

if (files.length === 0) {
  console.error("No test files discovered.");
  process.exit(1);
}

console.log(`Running ${files.length} test files`);

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...files],
  { stdio: "inherit" },
);

if (result.error) throw result.error;

process.exit(result.status ?? 1);
