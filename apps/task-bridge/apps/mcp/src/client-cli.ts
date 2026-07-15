#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolveBaseUrl, resolveToken } from "./api-client.js";

function usage() {
  process.stdout.write(
    [
      "Usage:",
      "  task-bridge-mcp-client list-tools",
      "  task-bridge-mcp-client list-resources",
      "  task-bridge-mcp-client read-resource <uri>",
      "  task-bridge-mcp-client call <toolName> <jsonArgs>",
      "",
      "Env: TASK_BRIDGE_URL, TASK_BRIDGE_TOKEN",
    ].join("\n") + "\n",
  );
}

function buildServerEnv() {
  const env: Record<string, string> = {};
  for (const entry of Object.entries(process.env)) {
    const key = entry[0];
    const value = entry[1];
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  env.TASK_BRIDGE_URL = resolveBaseUrl();
  env.TASK_BRIDGE_TOKEN = resolveToken();
  return env;
}

function resolveServerLaunch() {
  const dir = dirname(fileURLToPath(import.meta.url));
  const distEntry = join(dir, "index.js");
  if (existsSync(distEntry)) {
    return {
      command: process.execPath,
      args: [distEntry],
    };
  }
  const srcEntry = join(dir, "index.ts");
  return {
    command: "npx",
    args: ["tsx", srcEntry],
  };
}

async function withClient(run: (client: Client) => Promise<void>) {
  const launch = resolveServerLaunch();
  const transport = new StdioClientTransport({
    command: launch.command,
    args: launch.args,
    env: buildServerEnv(),
    cwd: process.cwd(),
  });

  const client = new Client({
    name: "task-bridge-mcp-client",
    version: "1.0.0",
  });

  await client.connect(transport);
  try {
    await run(client);
  } finally {
    await client.close();
  }
}

async function main() {
  const command = process.argv[2];
  if (!command) {
    usage();
    process.exit(1);
  }

  if (command === "list-tools") {
    await withClient(async (client) => {
      const result = await client.listTools();
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    });
    return;
  }

  if (command === "list-resources") {
    await withClient(async (client) => {
      const result = await client.listResources();
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    });
    return;
  }

  if (command === "read-resource") {
    const uri = process.argv[3];
    if (!uri) {
      usage();
      process.exit(1);
    }
    await withClient(async (client) => {
      const result = await client.readResource({ uri });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    });
    return;
  }

  if (command === "call") {
    const toolName = process.argv[3];
    const argsText = process.argv[4];
    if (!toolName) {
      usage();
      process.exit(1);
    }
    let args: Record<string, string | number | boolean | null> = {};
    if (typeof argsText === "string" && argsText.length > 0) {
      args = JSON.parse(argsText) as Record<string, string | number | boolean | null>;
    }
    await withClient(async (client) => {
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    });
    return;
  }

  usage();
  process.exit(1);
}

main().catch((error) => {
  let message = String(error);
  if (error instanceof Error) {
    message = error.message;
  }
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
