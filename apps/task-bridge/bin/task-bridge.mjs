#!/usr/bin/env node
import { spawn } from "node:child_process";

const CLOUD_URL = process.env.TASK_BRIDGE_URL || "https://task-bridge.fookiecloud.com";

function printHelp() {
  console.log(`task-bridge — Fookie Cloud epic / task board

Usage:
  npx @umudik/task-bridge

Opens ${CLOUD_URL}
Sign in with your Fookie Cloud account. Create API keys at https://fookiecloud.com/profile`);
}

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

console.log(`\n  Task Bridge runs on Fookie Cloud.\n  → ${CLOUD_URL}\n`);

function openBrowser(url) {
  let child;
  if (process.platform === "win32") {
    child = spawn("cmd", ["/c", "start", "", url.replaceAll("&", "^&")], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
  } else if (process.platform === "darwin") {
    child = spawn("open", [url], { detached: true, stdio: "ignore" });
  } else {
    child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
  }
  child.unref();
}

openBrowser(CLOUD_URL);
