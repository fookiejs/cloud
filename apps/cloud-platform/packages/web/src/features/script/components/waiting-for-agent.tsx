import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { FookieCloudMark } from "@/components/FookieCloudMark";
import { Button } from "@/components/ui/button";
import type { AgentInfo } from "@script/hooks/use-agent-connection";

const INSTALL_CMD = "npx -y @fookiejs/script@latest";

interface Props {
  info: AgentInfo | null;
}

export function WaitingForAgent(_props: Props): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="grid flex-1 place-items-center px-6 py-10">
        <div className="w-full max-w-lg space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="text-lg font-semibold tracking-tight">Script Manager</div>
            <FookieCloudMark size="sm" />
          </div>

          <div className="space-y-3 rounded-xl border bg-card/50 p-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Project scripts run on a node connected from your machine. Start the node in a terminal,
              sign in when asked, then attach its workspace from this project&apos;s Nodes page.
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-background p-1.5 pl-3 font-mono text-sm">
              <span className="select-none text-muted-foreground">$</span>
              <code className="flex-1 truncate">{INSTALL_CMD}</code>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  void copy();
                }}
                aria-label="Copy command"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
