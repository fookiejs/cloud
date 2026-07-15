import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDuration, formatTime, statusBadgeVariant, statusLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { api } from '@/api/client';
import { useStore, selectExecutionsOf, selectLiveLogsOf } from '@/state/store';
import type { InspectTarget } from '@/components/run-dots';
import type { ExecutionStatus } from '@/types';

function parseHistoryLog(raw: string): { stream: 'out' | 'err'; line: string }[] {
  const lines = raw.split('\n');
  const out: { stream: 'out' | 'err'; line: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (row === undefined) {
      continue;
    }
    if (row === '' && i === lines.length - 1) {
      continue;
    }
    if (row.startsWith('err\t')) {
      out.push({ stream: 'err', line: row.slice(4) });
    } else if (row.startsWith('out\t')) {
      out.push({ stream: 'out', line: row.slice(4) });
    } else {
      out.push({ stream: 'out', line: row });
    }
  }
  return out;
}

interface Props {
  target: InspectTarget;
  onCancel(executionId: string): void;
}

export function LogPanel(props: Props): React.JSX.Element {
  const history = useStore((s) => selectExecutionsOf(s, props.target.taskId));
  const live = useStore((s) => selectLiveLogsOf(s, props.target.taskId));
  const [historyLog, setHistoryLog] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isLive = props.target.isLive;

  useEffect(() => {
    if (isLive) {
      setHistoryLog('');
      return;
    }
    setLoading(true);
    api
      .getExecutionLog(props.target.executionId)
      .then((r) => {
        setHistoryLog(r.log);
      })
      .catch((e: unknown) => {
        toast.error(String(e));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [props.target.executionId, isLive]);

  let metaStatus: ExecutionStatus = 'pending';
  let metaTrigger = '—';
  let metaDuration = '—';
  let metaExit = '—';
  let metaStarted = '—';

  if (isLive) {
    for (const rt of live) {
      if (rt.id === props.target.executionId) {
        metaStatus = rt.status;
        metaTrigger = 'live';
        metaDuration = formatDuration(rt.startedAt, rt.endedAt);
        metaStarted = formatTime(rt.startedAt);
        if (rt.exitCode !== null) {
          metaExit = String(rt.exitCode);
        }
      }
    }
  } else {
    for (const e of history) {
      if (e.id === props.target.executionId) {
        metaStatus = e.status;
        metaTrigger = e.trigger_reason;
        metaDuration = formatDuration(e.started_at, e.ended_at);
        metaStarted = formatTime(e.started_at);
        if (e.exit_code !== null) {
          metaExit = String(e.exit_code);
        }
      }
    }
  }

  let logLines: { stream: 'out' | 'err'; line: string }[] = [];
  let logEmpty = 'No log output';
  if (isLive) {
    for (const rt of live) {
      if (rt.id === props.target.executionId) {
        logLines = rt.logLines.map((l) => ({ stream: l.stream, line: l.line }));
        logEmpty = 'Waiting for output…';
      }
    }
  } else if (historyLog.length > 0) {
    logLines = parseHistoryLog(historyLog);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (el === null) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [logLines, loading]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-2 flex flex-wrap items-center gap-2 text-xs border-b shrink-0">
        <Badge variant={statusBadgeVariant(metaStatus)}>{statusLabel(metaStatus)}</Badge>
        {isLive && <Badge variant="outline">Live</Badge>}
        <span className="text-muted-foreground font-mono truncate max-w-full">{metaTrigger}</span>
        <span className="text-muted-foreground">{metaDuration}</span>
        <span className="text-muted-foreground">exit {metaExit}</span>
        <span className="text-muted-foreground">{metaStarted}</span>
        {isLive && (
          <Button
            type="button"
            variant="warn"
            size="sm"
            className="ml-auto"
            onClick={() => {
              props.onCancel(props.target.executionId);
            }}
          >
            Cancel
          </Button>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-xs leading-relaxed bg-muted/20"
      >
        {loading && <div className="text-muted-foreground">Loading log…</div>}
        {!loading && logLines.length === 0 && (
          <div className="text-muted-foreground">{logEmpty}</div>
        )}
        {!loading &&
          logLines.map((l, idx) => {
            let cls = 'text-foreground';
            if (l.stream === 'err') {
              cls = 'text-destructive';
            }
            return (
              <div key={idx} className={cn(cls, 'flex gap-2')}>
                <span className="text-muted-foreground/40 select-none w-6 text-right shrink-0">
                  {String(idx + 1)}
                </span>
                <span className="break-all whitespace-pre-wrap">{l.line}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
