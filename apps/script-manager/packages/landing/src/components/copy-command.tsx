import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

const INSTALL_CMD = 'npx -y @umudik/lotaru@latest';

interface Props {
  className?: string;
}

function copyButtonIcon(copied: boolean): React.JSX.Element {
  if (copied) {
    return <Check className="h-4 w-4" />;
  }
  return <Copy className="h-4 w-4" />;
}

export function CopyCommand(props: Props): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border border-border/80 bg-card/80 backdrop-blur-sm p-1.5 pl-4 font-mono text-sm shadow-lg shadow-black/20',
        props.className,
      )}
    >
      <span className="text-muted-foreground select-none">$</span>
      <code className="flex-1 truncate text-foreground/95">{INSTALL_CMD}</code>
      <button
        type="button"
        onClick={() => {
          void copy();
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
        aria-label="Copy install command"
      >
        {copyButtonIcon(copied)}
      </button>
    </div>
  );
}
