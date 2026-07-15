import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const isWin = process.platform === "win32";
const children = [];

function loadEnv() {
  const path = join(root, ".env");
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    vars[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return vars;
}

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: isWin,
    cwd: root,
    ...options,
  });
  children.push(child);
  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(0);
}

async function main() {
  const env = loadEnv();

  const backendEnv = {
    ...process.env,
    ...env,
    PORT: env.PORT ?? "3000",
  };

  run("npm", ["--prefix", "apps/backend", "run", "dev"], { env: backendEnv });
  run("npm", ["--prefix", "apps/web", "run", "dev"]);

  console.log("");
  console.log("[dev] Web (HMR):  http://localhost:5173/app/login");
  console.log("[dev] API (watch): http://localhost:3000");
  console.log("");

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
