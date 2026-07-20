import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Github, Plus, RefreshCw, Rocket, Square, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { codeApi, type DeployStatus, type GithubRepo, type GithubStatus, type GitStatus } from "@/features/code/api";

type LinkMode = "existing" | "new";

function repoNoteFor(status: GitStatus): string {
  if (!status.linked) {
    return "";
  }
  if (status.dirty) {
    return "Uncommitted changes";
  }
  if (status.ahead > 0) {
    return `${String(status.ahead)} commit(s) to push`;
  }
  if (status.behind > 0) {
    return `${String(status.behind)} commit(s) behind`;
  }
  return "Up to date";
}

function DeployPanel(props: { projectId: string }): React.JSX.Element | null {
  const [status, setStatus] = useState<DeployStatus | null>(null);
  const [logs, setLogs] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await codeApi.deployStatus(props.projectId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load deploy status");
    }
  }, [props.projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function start(): Promise<void> {
    setBusy(true);
    try {
      const result = await codeApi.deployStart(props.projectId);
      toast.success("Deployed");
      window.open(result.url, "_blank", "noopener,noreferrer");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deploy failed");
    } finally {
      setBusy(false);
    }
  }

  async function redeploy(): Promise<void> {
    setBusy(true);
    try {
      await codeApi.deployRedeploy(props.projectId);
      toast.success("Redeployed");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Redeploy failed");
    } finally {
      setBusy(false);
    }
  }

  async function stop(): Promise<void> {
    setBusy(true);
    try {
      await codeApi.deployStop(props.projectId);
      toast.success("Stopped");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stop failed");
    } finally {
      setBusy(false);
    }
  }

  async function viewLogs(): Promise<void> {
    try {
      const result = await codeApi.deployLogs(props.projectId);
      setLogs(result.log);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load logs");
    }
  }

  if (status === null) {
    return null;
  }
  if (!status.deployed && !status.configured) {
    return null;
  }

  return (
    <div className="panel-card mx-auto max-w-xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">Deploy</h2>
        {status.deployed && status.running ? (
          <span className="text-xs font-medium text-success">Live</span>
        ) : status.deployed ? (
          <span className="text-xs font-medium text-muted-foreground">Stopped</span>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Run this project's code as a public, always-on service — the URL you can open on your
        phone.
      </p>
      {status.deployed && status.url !== null ? (
        <a
          href={status.url}
          target="_blank"
          rel="noreferrer"
          className="block truncate rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs text-foreground"
        >
          {status.url}
        </a>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!status.deployed || !status.running ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void start()}>
            <Rocket className="h-4 w-4" />
            Deploy
          </Button>
        ) : (
          <>
            <Button type="button" size="sm" disabled={busy} onClick={() => void redeploy()}>
              <Rocket className="h-4 w-4" />
              Redeploy
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void stop()}>
              <Square className="h-4 w-4" />
              Stop
            </Button>
          </>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => void viewLogs()}>
          Logs
        </Button>
      </div>
      {logs !== null ? (
        <pre className="max-h-64 overflow-y-auto rounded-md border bg-muted/20 p-3 text-[11px] leading-relaxed">
          {logs.length > 0 ? logs : "No logs yet."}
        </pre>
      ) : null}
    </div>
  );
}

export function CodeFeature(props: { projectId: string }): React.JSX.Element {
  const [github, setGithub] = useState<GithubStatus | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [linkMode, setLinkMode] = useState<LinkMode>("existing");
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [commitMessage, setCommitMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = await codeApi.githubStatus();
      setGithub(status);
      if (status.connected) {
        const git = await codeApi.gitStatus(props.projectId);
        setGitStatus(git);
        if (!git.linked) {
          const repoList = await codeApi.githubRepos();
          setRepos(repoList.repos);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [props.projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectGithub(): Promise<void> {
    try {
      const { url } = await codeApi.githubConnectUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start GitHub connect");
    }
  }

  async function linkRepo(): Promise<void> {
    const repo = repos?.find((r) => r.fullName === selectedRepo);
    if (repo === undefined) {
      toast.error("Pick a repository first");
      return;
    }
    setBusy(true);
    try {
      await codeApi.linkRepo(props.projectId, {
        owner: repo.fullName.split("/")[0] ?? "",
        repo: repo.fullName.split("/")[1] ?? "",
        branch: branch.length > 0 ? branch : repo.defaultBranch,
      });
      toast.success("Repository cloned");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clone failed");
    } finally {
      setBusy(false);
    }
  }

  async function createRepo(): Promise<void> {
    const name = newRepoName.trim();
    if (name.length === 0) {
      toast.error("Name the repository first");
      return;
    }
    setBusy(true);
    try {
      await codeApi.createRepo(props.projectId, {
        name,
        private: newRepoPrivate,
        description: "",
      });
      toast.success("Repository created and cloned");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Repository creation failed");
    } finally {
      setBusy(false);
    }
  }

  async function pull(): Promise<void> {
    setBusy(true);
    try {
      await codeApi.pull(props.projectId);
      toast.success("Pulled latest changes");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  }

  async function push(): Promise<void> {
    setBusy(true);
    try {
      await codeApi.push(props.projectId, commitMessage);
      toast.success("Pushed to GitHub");
      setCommitMessage("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Push failed");
    } finally {
      setBusy(false);
    }
  }

  async function openIde(): Promise<void> {
    setBusy(true);
    try {
      const { url } = await codeApi.startIde(props.projectId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the IDE");
    } finally {
      setBusy(false);
    }
  }

  let body: React.JSX.Element;
  if (loading) {
    body = (
      <div className="panel-card mx-auto max-w-xl p-6 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  } else if (github === null || !github.configured) {
    body = (
      <div className="panel-card mx-auto max-w-xl p-6 text-center text-sm text-muted-foreground">
        GitHub integration isn't configured on this server yet.
      </div>
    );
  } else if (!github.connected) {
    body = (
      <div className="panel-card mx-auto max-w-xl space-y-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Connect your GitHub account to clone a repo into this project.
        </p>
        <Button type="button" onClick={() => void connectGithub()}>
          <Github className="h-4 w-4" />
          Connect GitHub
        </Button>
      </div>
    );
  } else if (gitStatus === null || !gitStatus.linked) {
    body = (
      <div className="panel-card mx-auto max-w-xl space-y-4 p-6">
        <p className="text-sm text-muted-foreground">
          Connected as <span className="font-medium text-foreground">{github.login}</span>.
        </p>
        <div className="flex gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setLinkMode("existing")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              linkMode === "existing" ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            Use existing repo
          </button>
          <button
            type="button"
            onClick={() => setLinkMode("new")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              linkMode === "new" ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            Create new repo
          </button>
        </div>

        {linkMode === "existing" ? (
          <>
            <Select value={selectedRepo} onChange={(e) => setSelectedRepo(e.target.value)}>
              <option value="">Select a repository…</option>
              {(repos ?? []).map((repo) => (
                <option key={repo.fullName} value={repo.fullName}>
                  {repo.fullName}
                  {repo.private ? " (private)" : ""}
                </option>
              ))}
            </Select>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Branch (defaults to the repo's default branch)"
            />
            <Button type="button" disabled={busy || selectedRepo.length === 0} onClick={() => void linkRepo()}>
              Clone into project
            </Button>
          </>
        ) : (
          <>
            <Input
              value={newRepoName}
              onChange={(e) => setNewRepoName(e.target.value)}
              placeholder="Repository name"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={newRepoPrivate}
                onChange={(e) => setNewRepoPrivate(e.target.checked)}
              />
              Private repository
            </label>
            <Button type="button" disabled={busy || newRepoName.trim().length === 0} onClick={() => void createRepo()}>
              <Plus className="h-4 w-4" />
              Create & clone
            </Button>
          </>
        )}
      </div>
    );
  } else {
    const status = gitStatus;
    body = (
      <div className="space-y-5">
        <div className="panel-card mx-auto max-w-xl space-y-4 p-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              {status.owner}/{status.repo}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Branch <span className="font-mono">{status.branch}</span> · {repoNoteFor(status)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void openIde()}>
              <ExternalLink className="h-4 w-4" />
              Open IDE
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void pull()}>
              <RefreshCw className="h-4 w-4" />
              Pull
            </Button>
          </div>
          <div className="flex flex-col gap-2 border-t pt-4">
            <Input
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message"
            />
            <Button type="button" size="sm" disabled={busy} onClick={() => void push()} className="self-start">
              <UploadCloud className="h-4 w-4" />
              Commit & push
            </Button>
          </div>
        </div>
        <DeployPanel projectId={props.projectId} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        breadcrumb={[
          { label: "Projects", to: "/projects" },
          { label: props.projectId, to: `/projects/${props.projectId}/tasks` },
          { label: "Code", to: null },
        ]}
        title="Code"
        subtitle="Clone a GitHub repo and edit it in a browser IDE"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-5">{body}</div>
    </div>
  );
}
