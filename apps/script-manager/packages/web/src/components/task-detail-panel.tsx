import { useEffect, useState } from 'react';
import { Copy, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CommandField } from '@/components/command-editor-dialog';
import { patchTask } from '@/lib/task-patch';
import { duplicateTaskBody } from '@/lib/project-templates';
import { CRON_PRESETS, resolveCronExpression } from '@/lib/cron-presets';
import { DOCKER_PLATFORM_OPTIONS, platformSelectValue } from '@/lib/docker-platform';
import { nullToEmpty } from '@/lib/format';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import { ConfirmDuplicateDialog } from '@/components/confirm-duplicate-dialog';
import { TaskHistory } from '@/components/task-history';
import { LogPanel } from '@/components/log-panel';
import type { InspectTarget } from '@/components/run-dots';
import { cn } from '@/lib/utils';
import { api } from '@/api/client';
import { actions, useStore, selectTasksOf } from '@/state/store';
import type { Task, RuntimeKind, TriggerKind, ConcurrencyKind } from '@/types';

const runtimeOptions: readonly { value: RuntimeKind; label: string }[] = [
  { value: 'shell', label: 'Shell' },
  { value: 'docker', label: 'Docker' },
];
const triggerOptions: readonly { value: TriggerKind; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'save', label: 'On save' },
  { value: 'startup', label: 'Startup' },
  { value: 'scheduled', label: 'Scheduled' },
];
const concurrencyOptions: readonly { value: ConcurrencyKind; label: string }[] = [
  { value: 'restart', label: 'Restart' },
  { value: 'queue', label: 'Queue' },
  { value: 'ignore', label: 'Ignore' },
  { value: 'parallel', label: 'Parallel' },
];

function enabledLabel(enabled: boolean): string {
  if (enabled) {
    return 'On';
  }
  return 'Off';
}

function emptyToNull(v: string): string | null {
  if (v === '') {
    return null;
  }
  return v;
}

type DetailTab = 'task' | 'logs';

interface Props {
  task: Task;
  inspectId: string | null;
  inspect: InspectTarget | null;
  detailTab: DetailTab;
  onDetailTabChange(tab: DetailTab): void;
  existingTaskNames: readonly string[];
  onInspect(target: InspectTarget): void;
  onCancelExecution(executionId: string): void;
  onClosePanel(): void;
  onDuplicated(task: Task): void;
  onDeleted(taskId: string): void;
}

function detailTabClass(active: boolean): string {
  if (active) {
    return 'border-primary text-foreground';
  }
  return 'border-transparent text-muted-foreground hover:text-foreground';
}

export function TaskDetailPanel(props: Props): React.JSX.Element {
  const t = useStore((s) => {
    const list = selectTasksOf(s, props.task.workspace_id);
    for (const row of list) {
      if (row.id === props.task.id) {
        return row;
      }
    }
    return props.task;
  });
  const [name, setName] = useState(t.name);
  const [command, setCommand] = useState(t.command);
  const [glob, setGlob] = useState(nullToEmpty(t.trigger_glob));
  const [dockerImage, setDockerImage] = useState(nullToEmpty(t.docker_image));
  const [enabled, setEnabled] = useState(t.enabled);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setName(t.name);
    setCommand(t.command);
    setGlob(nullToEmpty(t.trigger_glob));
    setDockerImage(nullToEmpty(t.docker_image));
    setEnabled(t.enabled);
  }, [t.id, t.name, t.command, t.trigger_glob, t.trigger_cron, t.docker_image, t.enabled]);

  async function saveField(partial: Partial<Task>): Promise<void> {
    try {
      await patchTask(t, partial);
    } catch (e: unknown) {
      toast.error(String(e));
    }
  }

  async function setTaskEnabled(next: boolean): Promise<void> {
    if (next === t.enabled) {
      return;
    }
    setEnabled(next);
    try {
      await patchTask(t, { enabled: next });
    } catch (e: unknown) {
      setEnabled(t.enabled);
      toast.error(String(e));
    }
  }

  const duplicatePreview = duplicateTaskBody(t, props.existingTaskNames);

  async function duplicate(): Promise<void> {
    const body = duplicateTaskBody(t, props.existingTaskNames);
    const r = await api.createTask(t.workspace_id, body);
    actions.upsertTask(r.task);
    toast.success('Task duplicated');
    props.onDuplicated(r.task);
  }

  async function removeTask(): Promise<void> {
    await api.deleteTask(t.id);
    actions.removeTask(t.id);
    toast.success('Task deleted');
    props.onDeleted(t.id);
  }

  const scheduleValue = resolveCronExpression(t.trigger_cron);

  let platformInput: React.JSX.Element | null = null;
  if (t.runtime === 'docker') {
    platformInput = (
      <div className="flex flex-col gap-1.5 min-w-0">
        <Label className="text-xs text-muted-foreground">Architecture</Label>
        <Select
          value={platformSelectValue(t.docker_platform)}
          onValueChange={(v) => {
            let next: string | null = null;
            if (v !== 'auto') {
              next = v;
            }
            void saveField({ docker_platform: next });
          }}
        >
          <SelectTrigger className="h-9 text-xs w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCKER_PLATFORM_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  let dockerImageInput: React.JSX.Element | null = null;
  if (t.runtime === 'docker') {
    dockerImageInput = (
      <div className="flex flex-col gap-1.5 min-w-0">
        <Label className="text-xs text-muted-foreground">Docker image</Label>
        <Input
          value={dockerImage}
          onChange={(e) => {
            setDockerImage(e.target.value);
          }}
          onBlur={() => {
            void saveField({ docker_image: emptyToNull(dockerImage) });
          }}
          placeholder="node:22-alpine"
          className="font-mono h-9 text-xs w-full"
        />
      </div>
    );
  }

  let globInput: React.JSX.Element | null = null;
  if (t.trigger_type === 'save') {
    globInput = (
      <div className="flex flex-col gap-1.5 min-w-0">
        <Label className="text-xs text-muted-foreground">Path filter</Label>
        <Input
          value={glob}
          onChange={(e) => {
            setGlob(e.target.value);
          }}
          onBlur={() => {
            void saveField({ trigger_glob: emptyToNull(glob) });
          }}
          placeholder="**/*.ts"
          className="font-mono h-9 text-xs w-full"
        />
      </div>
    );
  }

  let cronInput: React.JSX.Element | null = null;
  if (t.trigger_type === 'scheduled') {
    cronInput = (
      <div className="flex flex-col gap-1.5 min-w-0">
        <Label className="text-xs text-muted-foreground">Schedule</Label>
        <Select
          value={scheduleValue}
          onValueChange={(v) => {
            void saveField({ trigger_cron: v });
          }}
        >
          <SelectTrigger className="h-9 text-xs w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRON_PRESETS.map((p) => (
              <SelectItem key={p.expression} value={p.expression}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  let logsBody: React.JSX.Element;
  if (props.inspect !== null) {
    logsBody = <LogPanel target={props.inspect} onCancel={props.onCancelExecution} />;
  } else {
    logsBody = (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground text-center">
        Select a run from history to view logs.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden border-l">
      <div className="flex items-center justify-between gap-2 shrink-0 px-4 py-3 border-b">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            className={cn(
              'text-sm font-semibold px-2 py-1 border-b-2 transition-colors',
              detailTabClass(props.detailTab === 'task'),
            )}
            onClick={() => {
              props.onDetailTabChange('task');
            }}
          >
            Task
          </button>
          <button
            type="button"
            className={cn(
              'text-sm font-semibold px-2 py-1 border-b-2 transition-colors',
              detailTabClass(props.detailTab === 'logs'),
            )}
            onClick={() => {
              props.onDetailTabChange('logs');
            }}
          >
            Logs
          </button>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setDuplicateOpen(true);
            }}
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => {
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={props.onClosePanel}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <ConfirmDuplicateDialog
        open={duplicateOpen}
        name={t.name}
        copyName={duplicatePreview.name}
        onOpenChange={setDuplicateOpen}
        onConfirm={duplicate}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        kind="task"
        name={t.name}
        onOpenChange={setDeleteOpen}
        onConfirm={removeTask}
      />

      {props.detailTab === 'task' && (
        <div className="flex flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto p-4">
          <div className="flex items-center gap-3 shrink-0">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              onBlur={() => {
                if (name !== t.name) {
                  void saveField({ name });
                }
              }}
              className="h-9 font-medium flex-1"
            />
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={enabled}
                onCheckedChange={(v) => {
                  void setTaskEnabled(v);
                }}
              />
              <span className="text-xs text-muted-foreground">{enabledLabel(enabled)}</span>
            </div>
          </div>

          <CommandField
            value={command}
            runtime={t.runtime}
            onSave={(next) => {
              setCommand(next);
              if (next !== t.command) {
                void saveField({ command: next });
              }
            }}
          />

          <div className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-3 shrink-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 min-w-0">
                <Label className="text-xs text-muted-foreground">Trigger</Label>
                <Select
                  value={t.trigger_type}
                  onValueChange={(v) => {
                    const kind = v as TriggerKind;
                    if (kind === 'scheduled') {
                      void saveField({
                        trigger_type: kind,
                        trigger_cron: resolveCronExpression(t.trigger_cron),
                      });
                      return;
                    }
                    void saveField({ trigger_type: kind });
                  }}
                >
                  <SelectTrigger className="h-9 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                <Label className="text-xs text-muted-foreground">Concurrency</Label>
                <Select
                  value={t.concurrency}
                  onValueChange={(v) => {
                    void saveField({ concurrency: v as ConcurrencyKind });
                  }}
                >
                  <SelectTrigger className="h-9 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {concurrencyOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <Label className="text-xs text-muted-foreground">Runtime</Label>
              <Select
                value={t.runtime}
                onValueChange={(v) => {
                  void saveField({ runtime: v as RuntimeKind });
                }}
              >
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {runtimeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {platformInput}
            {globInput}
            {cronInput}
            {dockerImageInput}
          </div>

          <TaskHistory taskId={t.id} selectedId={props.inspectId} onInspect={props.onInspect} />
        </div>
      )}

      {props.detailTab === 'logs' && (
        <div className="flex flex-1 min-h-0 flex flex-col">{logsBody}</div>
      )}
    </div>
  );
}
