import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Github, RefreshCw, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { codeApi, type GithubRepo, type GithubStatus, type GitStatus } from "@/features/code/api";

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

export function CodeFeature(props: { projectId: string }): React.JSX.Element {
  const [github, setGithub] = useState<GithubStatus | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [branch, setBranch] = useState("");
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
          Connected as <span className="font-medium text-foreground">{github.login}</span>. Pick a
          repository to clone into this project's folder.
        </p>
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
      </div>
    );
  } else {
    const status = gitStatus;
    body = (
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
