import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const LOCAL_MCP = `{
  "mcpServers": {
    "task-bridge": {
      "command": "npx",
      "args": ["-y", "@umudik/task-bridge-mcp"],
      "env": {
        "TASK_BRIDGE_URL": "http://localhost:3000",
        "TASK_BRIDGE_TOKEN": "<paste-token>"
      }
    }
  }
}`;

const CLOUD_MCP = `{
  "mcpServers": {
    "task-bridge": {
      "command": "npx",
      "args": ["-y", "@umudik/task-bridge-mcp"],
      "env": {
        "TASK_BRIDGE_URL": "https://task-bridge.fookiecloud.com",
        "FOOKIE_API_KEY": "<paste-key>"
      }
    }
  }
}`;

function isCloudHost(): boolean {
  return window.location.hostname === "task-bridge.fookiecloud.com";
}

export function McpSetup() {
  const cloud = isCloudHost();
  const snippet = cloud ? CLOUD_MCP : LOCAL_MCP;
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border bg-card/50 p-5 space-y-3">
      <div>
        <div className="text-sm font-semibold tracking-tight">Cursor MCP</div>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {cloud ? (
            <>
              Create an API key on your{" "}
              <a
                href="https://fookiecloud.com/profile"
                className="fookie-cloud-word font-medium hover:opacity-90"
                target="_blank"
                rel="noreferrer"
              >
                Fookie Cloud
              </a>{" "}
              profile, paste it into <code className="font-mono text-xs">.cursor/mcp.json</code>, then
              reload MCP in Cursor.
            </>
          ) : (
            <>
              Add this to <code className="font-mono text-xs">.cursor/mcp.json</code> while Task Bridge
              is running locally, then reload MCP in Cursor.
            </>
          )}
        </p>
      </div>
      <div className="relative rounded-md border bg-background">
        <pre className="overflow-x-auto p-3 pr-12 text-[11px] leading-relaxed font-mono text-muted-foreground whitespace-pre">
          {snippet}
        </pre>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={() => void copy()}
          aria-label="Copy MCP config"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
