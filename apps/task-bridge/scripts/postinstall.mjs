import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function runNpmInstall(prefix) {
  const result = spawnSync("npm", ["install", "--prefix", prefix], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const backendPkg = "apps/backend/package.json";
const webPkg = "apps/web/package.json";

if (existsSync(backendPkg) && existsSync(webPkg)) {
  runNpmInstall("apps/backend");
  runNpmInstall("apps/web");
}
