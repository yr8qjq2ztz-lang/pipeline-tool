import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const [cmd = "dev", ...args] = process.argv.slice(2);

// Next.js CLI accepts an optional directory argument as the first positional
// parameter for `dev`, `build`, and `start`. Passing it explicitly makes the
// scripts robust even if the caller's cwd is not the project root.
const needsDir = cmd === "dev" || cmd === "build" || cmd === "start";
const cliArgs = needsDir ? [nextCli, cmd, projectRoot, ...args] : [nextCli, cmd, ...args];

const child = spawn(process.execPath, cliArgs, {
  stdio: "inherit",
  cwd: projectRoot,
  env: {
    ...process.env,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 0;
});
