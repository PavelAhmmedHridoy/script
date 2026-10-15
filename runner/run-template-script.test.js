/**
 * run-template-script.test.js — the argv handed to each package manager.
 *
 * `--` is npm-only: npm needs it to stop parsing flags like `--port` itself,
 * while pnpm/yarn/bun forward trailing args on their own and pass a literal
 * `--` straight through to the script. pnpm doing that made Vite see
 * `-- --port 7681 --host`, stop parsing at the `--`, and ignore the configured
 * port — the dev server stayed on Vite's default 5173.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildArgv } = require("./run-template-script");

const DEV_ARGS = ["--port", "7681", "--host"];

test("npm runs the script with `run` and a `--` separator", () => {
  assert.deepEqual(buildArgv("npm", "dev", DEV_ARGS), [
    "run",
    "dev",
    "--",
    ...DEV_ARGS,
  ]);
});

test("npm runs its bare script names without `run`, keeping the separator", () => {
  assert.deepEqual(buildArgv("npm", "start", ["--port", "8081"]), [
    "start",
    "--",
    "--port",
    "8081",
  ]);
});

test("pnpm/yarn/bun get the args unseparated, so the script parses them", () => {
  for (const pm of ["pnpm", "yarn", "bun"]) {
    assert.deepEqual(buildArgv(pm, "dev", DEV_ARGS), ["dev", ...DEV_ARGS]);
    assert.deepEqual(buildArgv(pm, "start", ["--port", "8081"]), [
      "start",
      "--port",
      "8081",
    ]);
  }
});

test("a doubled \"run \" prefix in the configured script name is stripped", () => {
  assert.deepEqual(buildArgv("npm", "run dev", DEV_ARGS), [
    "run",
    "dev",
    "--",
    ...DEV_ARGS,
  ]);
  assert.deepEqual(buildArgv("pnpm", "run dev", DEV_ARGS), ["dev", ...DEV_ARGS]);
});

test("no extra args leaves the command untouched", () => {
  assert.deepEqual(buildArgv("npm", "dev", []), ["run", "dev"]);
  assert.deepEqual(buildArgv("pnpm", "dev", []), ["dev"]);
});
