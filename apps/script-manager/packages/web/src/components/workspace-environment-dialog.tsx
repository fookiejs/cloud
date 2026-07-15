import { useCallback, useEffect, useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/api/client';
import { actions } from '@/state/store';
import type { Environment } from '@/types';

interface EnvRow {
  rowId: string;
  key: string;
  value: string;
}

let rowCounter = 0;
function newRowId(): string {
  rowCounter += 1;
  return `row-${String(rowCounter)}`;
}

function varsToRows(vars: Record<string, string>): EnvRow[] {
  const rows: EnvRow[] = [];
  for (const key of Object.keys(vars)) {
    const val = vars[key];
    if (val !== undefined) {
      rows.push({ rowId: newRowId(), key, value: val });
    }
  }
  if (rows.length === 0) {
    rows.push({ rowId: newRowId(), key: '', value: '' });
  }
  return rows;
}

function rowsToVars(rows: EnvRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const k = row.key.trim();
    if (k.length > 0) {
      out[k] = row.value;
    }
  }
  return out;
}

function findEnvironmentName(environments: Environment[], id: string | null): string {
  if (id === null) {
    return 'None';
  }
  for (const env of environments) {
    if (env.id === id) {
      return env.name;
    }
  }
  return 'None';
}

interface Props {
  workspaceId: string;
  activeEnvironmentId: string | null;
}

export function WorkspaceEnvironmentDialog(props: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(props.activeEnvironmentId);
  const [rows, setRows] = useState<EnvRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadEnvironments = useCallback(async (): Promise<void> => {
    try {
      const r = await api.listEnvironments(props.workspaceId);
      setEnvironments(r.environments);
    } catch (e: unknown) {
      toast.error(String(e));
    }
  }, [props.workspaceId]);

  useEffect(() => {
    void loadEnvironments();
  }, [loadEnvironments]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedId(props.activeEnvironmentId);
    void loadEnvironments();
  }, [open, props.activeEnvironmentId, loadEnvironments]);

  useEffect(() => {
    if (selectedId === null) {
      setRows([]);
      setDirty(false);
      return;
    }
    let found: Environment | null = null;
    for (const env of environments) {
      if (env.id === selectedId) {
        found = env;
      }
    }
    if (found !== null) {
      setRows(varsToRows(found.vars));
      setDirty(false);
    }
  }, [selectedId, environments]);

  async function selectEnvironment(id: string): Promise<void> {
    if (id === 'none') {
      try {
        await api.setActiveEnvironment(props.workspaceId, null);
        setSelectedId(null);
        await actions.refreshWorkspaces();
      } catch (e: unknown) {
        toast.error(String(e));
      }
      return;
    }
    try {
      await api.setActiveEnvironment(props.workspaceId, id);
      setSelectedId(id);
      await actions.refreshWorkspaces();
    } catch (e: unknown) {
      toast.error(String(e));
    }
  }

  async function createEnvironment(): Promise<void> {
    const name = newName.trim();
    if (name.length === 0) {
      toast.error('Name required');
      return;
    }
    setCreating(true);
    try {
      const r = await api.createEnvironment(props.workspaceId, { name, vars: {} });
      setEnvironments((prev) => [...prev, r.environment]);
      await api.setActiveEnvironment(props.workspaceId, r.environment.id);
      setSelectedId(r.environment.id);
      setRows(varsToRows({}));
      setDirty(false);
      setNewName('');
      await actions.refreshWorkspaces();
      toast.success('Environment created');
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setCreating(false);
    }
  }

  async function saveEnvironment(): Promise<void> {
    if (selectedId === null) {
      return;
    }
    setSaving(true);
    try {
      const vars = rowsToVars(rows);
      const r = await api.updateEnvironment(selectedId, { vars });
      setEnvironments((prev) => {
        const next: Environment[] = [];
        for (const env of prev) {
          if (env.id === r.environment.id) {
            next.push(r.environment);
          } else {
            next.push(env);
          }
        }
        return next;
      });
      setDirty(false);
      toast.success('Saved');
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  function updateRow(rowId: string, field: 'key' | 'value', text: string): void {
    setRows((prev) => {
      const next: EnvRow[] = [];
      for (const row of prev) {
        if (row.rowId === rowId) {
          if (field === 'key') {
            next.push({ ...row, key: text });
          } else {
            next.push({ ...row, value: text });
          }
        } else {
          next.push(row);
        }
      }
      return next;
    });
    setDirty(true);
  }

  function addRow(): void {
    setRows((prev) => [...prev, { rowId: newRowId(), key: '', value: '' }]);
    setDirty(true);
  }

  function removeRow(rowId: string): void {
    setRows((prev) => {
      const next: EnvRow[] = [];
      for (const row of prev) {
        if (row.rowId !== rowId) {
          next.push(row);
        }
      }
      if (next.length === 0) {
        next.push({ rowId: newRowId(), key: '', value: '' });
      }
      return next;
    });
    setDirty(true);
  }

  let selectValue = 'none';
  if (selectedId !== null) {
    selectValue = selectedId;
  }

  const activeLabel = findEnvironmentName(environments, props.activeEnvironmentId);

  let saveDisabled = !dirty;
  if (saving) {
    saveDisabled = true;
  }

  let varsSection: React.JSX.Element;
  if (selectedId === null) {
    varsSection = (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Select or create an environment to edit variables.
      </p>
    );
  } else {
    varsSection = (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Variables
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              addRow();
            }}
          >
            Add variable
          </Button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {rows.map((row) => (
            <div key={row.rowId} className="flex items-center gap-2">
              <Input
                placeholder="KEY"
                value={row.key}
                onChange={(e) => {
                  updateRow(row.rowId, 'key', e.target.value);
                }}
                className="h-8 text-xs font-mono flex-1"
              />
              <Input
                placeholder="value"
                value={row.value}
                onChange={(e) => {
                  updateRow(row.rowId, 'value', e.target.value);
                }}
                className="h-8 text-xs flex-1"
                type="password"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  removeRow(row.rowId);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  let saveButton: React.JSX.Element | null = null;
  if (selectedId !== null) {
    saveButton = (
      <Button
        type="button"
        onClick={() => {
          void saveEnvironment();
        }}
        disabled={saveDisabled}
      >
        Save
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Layers className="w-3.5 h-3.5" />
        {activeLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Environment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Active
              </span>
              <Select
                value={selectValue}
                onValueChange={(v) => {
                  void selectEnvironment(v);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {environments.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                New environment
              </span>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="dev"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void createEnvironment();
                    }
                  }}
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-9"
                  onClick={() => {
                    void createEnvironment();
                  }}
                  disabled={creating}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {varsSection}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Close
            </Button>
            {saveButton}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
