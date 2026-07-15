import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { isCloudHost } from '@/lib/auth';

const FOOKIE_CLOUD_MCP = `{
  "mcpServers": {
    "fookie-cloud": {
      "command": "npx",
      "args": ["-y", "@umudik/fookie-cloud-mcp"],
      "env": {
        "FOOKIE_API_KEY": "<paste-key>",
        "NOTES_URL": "https://notes.fookiecloud.com",
        "TASK_BRIDGE_URL": "https://task.fookiecloud.com",
        "LOTARU_API_URL": "https://script.fookiecloud.com"
      }
    }
  }
}`;

export function McpSetup(): React.JSX.Element {
  const cloud = isCloudHost();
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(FOOKIE_CLOUD_MCP);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <div className="rounded-xl border bg-card/50 p-5 space-y-3">
      <div>
        <div className="text-sm font-semibold tracking-tight">Cursor MCP</div>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {cloud ? (
            <>
              Use the unified Fookie Cloud MCP. Create an API key on your{' '}
              <a
                href="https://fookiecloud.com/profile"
                className="fookie-cloud-word font-medium hover:opacity-90"
                target="_blank"
                rel="noreferrer"
              >
                Fookie Cloud
              </a>{' '}
              profile, paste it into <code className="font-mono text-xs">.cursor/mcp.json</code>, then
              reload MCP in Cursor.
            </>
          ) : (
            <>
              Add the unified Fookie Cloud MCP to{' '}
              <code className="font-mono text-xs">.cursor/mcp.json</code> while the local agent is
              running, then reload MCP in Cursor.
            </>
          )}
        </p>
      </div>
      <div className="relative rounded-md border bg-background">
        <pre className="overflow-x-auto p-3 pr-12 text-[11px] leading-relaxed font-mono text-muted-foreground whitespace-pre">
          {FOOKIE_CLOUD_MCP}
        </pre>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={() => {
            void copy();
          }}
          aria-label="Copy MCP config"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
