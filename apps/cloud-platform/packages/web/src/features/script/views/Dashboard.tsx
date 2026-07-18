import { useRef, useState, type MouseEvent } from 'react';
import { FolderInput, Settings2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@script/components/ui/select';
import { cn } from '@/lib/utils';
import {
  EMPTY_PROJECT_TEMPLATE_ID,
  PROJECT_TEMPLATES,
  projectTemplateTasks,
  seedWorkspaceTasks,
} from '@script/lib/project-templates';
import { statusDotClass, tsOrZero } from '@script/lib/format';
import { actions, useStore } from '@script/state/store';
import { api } from '@script/api/client';
import { ConfirmDeleteDialog } from '@script/components/confirm-delete-dialog';
import { ProjectImportDialog } from '@script/components/project-import-dialog';
import { ProjectSettingsDialog } from '@script/components/project-settings';
import { isProjectExportBundle } from '@script/lib/project-export';
import type { ProjectExportBundle } from '@script/lib/project-export';
import { navigate } from '@script/navigate';
import type { Workspace, Execution, ExecutionStatus } from '@script/types';

function projectCreatedTaskNote(taskCount: number): string {
  if (taskCount > 0) {
    return ` with ${String(taskCount)} tasks`;
  }
  return '';
}

function workspaceRunningCount(
  workspaceId: string,
  tasksByWorkspace: Record<string, { id: string }[]>,
  liveExec: Record<string, { taskId: string; status: ExecutionStatus }>,
): number {
  const tasks = tasksByWorkspace[workspaceId];
  if (tasks === undefined) {
    return 0;
  }
  const taskIds = new Set<string>();
  for (const t of tasks) {
    taskIds.add(t.id);
  }
  let count = 0;
  for (const key of Object.keys(liveExec)) {
    const e = liveExec[key];
    if (e === undefined) {
      continue;
    }
    if (taskIds.has(e.taskId) && e.status === 'running') {
      count += 1;
    }
  }
  return count;
}

function workspaceRecentDots(
  workspaceId: string,
  tasksByWorkspace: Record<string, { id: string }[]>,
  executionsByTask: Record<string, Execution[]>,
  recentExecutions: Execution[],
): Execution[] {
  const tasks = tasksByWorkspace[workspaceId];
  if (tasks === undefined) {
    return [];
  }
  const taskIds = new Set<string>();
  for (const t of tasks) {
    taskIds.add(t.id);
  }
  const collected: Execution[] = [];
  for (const e of recentExecutions) {
    if (taskIds.has(e.task_id)) {
      collected.push(e);
    }
  }
  if (collected.length >= 5) {
    return collected.slice(0, 5);
  }
  for (const t of tasks) {
    const list = executionsByTask[t.id];
    if (list === undefined) {
      continue;
    }
    for (const e of list) {
      let found = false;
      for (const c of collected) {
        if (c.id === e.id) {
          found = true;
        }
      }
      if (!found) {
        collected.push(e);
      }
    }
  }
  collected.sort((a, b) => tsOrZero(b.started_at) - tsOrZero(a.started_at));
  return collected.slice(0, 5);
}

interface ProjectCardProps {
  workspace: Workspace;
}

function stopCardNav(e: MouseEvent): void {
  e.stopPropagation();
  e.preventDefault();
}

function ProjectCard(props: ProjectCardProps): React.JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const tasksByWorkspace = useStore((s) => s.tasksByWorkspace);
  const liveExec = useStore((s) => s.liveExecutions);
  const executionsByTask = useStore((s) => s.executionsByTask);
  const recentExecutions = useStore((s) => s.recentExecutions);

  const w = props.workspace;
  const tasks = tasksByWorkspace[w.id];
  let taskCount = 0;
  if (tasks !== undefined) {
    taskCount = tasks.length;
  }
  const running = workspaceRunningCount(w.id, tasksByWorkspace, liveExec);
  const dots = workspaceRecentDots(w.id, tasksByWorkspace, executionsByTask, recentExecutions);

  let badge: React.JSX.Element = <Badge variant="success">Live</Badge>;
  if (w.paused) {
    badge = <Badge variant="warn">Paused</Badge>;
  }

  async function removeProject(): Promise<void> {
    await api.deleteWorkspace(w.id);
    await actions.refreshWorkspaces();
    toast.success('Project deleted');
  }

  return (
    <>
      <Card
        className="hover:bg-secondary/30 transition-colors h-full cursor-pointer"
        onClick={() => {
          navigate(`/workspace/${w.id}`);
        }}
      >
        <CardContent className="p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-lg bg-secondary border grid place-items-center text-sm font-semibold shrink-0">
                {w.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold truncate">{w.name}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  stopCardNav(e);
                  setSettingsOpen(true);
                }}
              >
                <Settings2 className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  stopCardNav(e);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              {badge}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{`${String(taskCount)} tasks`}</span>
            {running > 0 && <span className="text-running">{`${String(running)} running`}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {dots.map((e) => (
              <span
                key={e.id}
                className={cn('w-2 h-2 rounded-full', statusDotClass(e.status))}
                title={e.status}
              />
            ))}
            {dots.length === 0 && (
              <span className="text-xs text-muted-foreground">No runs yet</span>
            )}
          </div>
        </CardContent>
      </Card>
      <ProjectSettingsDialog workspace={w} open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ConfirmDeleteDialog
        open={deleteOpen}
        kind="project"
        name={w.name}
        onOpenChange={setDeleteOpen}
        onConfirm={removeProject}
      />
    </>
  );
}

interface AddWorkspaceProps {
  projectId: string;
  onDone(): void;
}

function AddWorkspace(props: AddWorkspaceProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState(EMPTY_PROJECT_TEMPLATE_ID);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setError(null);
    if (name.length === 0) {
      setError('Name required.');
      return;
    }
    setBusy(true);
    try {
      const { workspace } = await api.createWorkspace(name, props.projectId);
      const taskBodies = projectTemplateTasks(templateId);
      await seedWorkspaceTasks(workspace.id, taskBodies);
      await actions.refreshWorkspaces();
      await actions.refreshTasks(workspace.id);
      setName('');
      setTemplateId(EMPTY_PROJECT_TEMPLATE_ID);
      props.onDone();
      toast.success(`Workspace created${projectCreatedTaskNote(taskBodies.length)}`);
      navigate(`/workspace/${workspace.id}`);
    } catch (e: unknown) {
      setError(String(e));
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs" htmlFor="ws-name">
            Name
          </Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder="daily-report"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label} — {t.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Scripts run in an isolated sandbox on Fookie Cloud with its own persistent storage.
        </p>
        {error !== null && <div className="text-xs text-destructive">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={props.onDone} variant="outline" size="sm">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              void submit();
            }}
            disabled={busy}
            size="sm"
          >
            <FolderInput className="w-3.5 h-3.5" /> Create
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardView(props: { projectId: string }): React.JSX.Element {
  const workspaces = useStore((s) => s.workspaces);
  const [adding, setAdding] = useState(false);
  const [importBundle, setImportBundle] = useState<ProjectExportBundle | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function openImportPicker(): void {
    if (fileRef.current !== null) {
      fileRef.current.value = '';
      fileRef.current.click();
    }
  }

  function onImportFileSelected(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = e.target.files;
    if (files === null || files.length === 0) {
      return;
    }
    const file = files[0];
    if (file === undefined) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        if (typeof text !== 'string') {
          toast.error('Could not read project file');
          return;
        }
        const raw: unknown = JSON.parse(text);
        if (!isProjectExportBundle(raw)) {
          toast.error('Invalid Script Manager project file');
          return;
        }
        setImportBundle(raw);
        setImportOpen(true);
      } catch {
        toast.error('Could not parse JSON file');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Script workspaces</h1>
        </div>
        {!adding && (
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={openImportPicker}>
              <Upload className="w-4 h-4" />
              Import JSON
            </Button>
            <Button
              type="button"
              onClick={() => {
                setAdding(true);
              }}
            >
              Add workspace
            </Button>
          </div>
        )}
      </header>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFileSelected}
      />
      <ProjectImportDialog
        open={importOpen}
        bundle={importBundle}
        projectId={props.projectId}
        onOpenChange={setImportOpen}
        onImported={(workspaceId) => {
          void actions.refreshWorkspaces();
          navigate(`/workspace/${workspaceId}`);
        }}
      />

      {adding && (
        <AddWorkspace
          projectId={props.projectId}
          onDone={() => {
            setAdding(false);
          }}
        />
      )}

      {workspaces.length === 0 && !adding && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No workspaces yet. Add one to get started.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map((w) => (
          <ProjectCard key={w.id} workspace={w} />
        ))}
      </div>
    </div>
  );
}
