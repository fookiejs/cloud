import Database from "better-sqlite3";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { userCanAccessProject } from "../../../../../task-bridge/apps/backend/dist/services/project-registry.js";
import type { GithubAuth } from "./github-auth.js";
import type { Identity, IdentityUser } from "./identity.js";
import { projectDir, type ProjectPathsOptions } from "./project-paths.js";

const execFileAsync = promisify(execFile);

export type GitProjectsOptions = ProjectPathsOptions & {
  identity: Identity;
  github: GithubAuth;
};

type RepoRow = {
  project_id: string;
  owner_id: string;
  github_owner: string;
  github_repo: string;
  default_branch: string;
  linked_at: number;
};

function repoUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}

function authedRepoUrl(token: string, owner: string, repo: string): string {
  return `https://${token}@github.com/${owner}/${repo}.git`;
}

async function runGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, { cwd, maxBuffer: 1024 * 1024 * 32 });
}

export async function registerGitProjectsModule(
  app: FastifyInstance,
  options: GitProjectsOptions,
): Promise<void> {
  const db = new Database(join(options.dataDir, "git.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_repos (
      project_id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      github_owner TEXT NOT NULL,
      github_repo TEXT NOT NULL,
      default_branch TEXT NOT NULL,
      linked_at INTEGER NOT NULL
    );
  `);

  function getRepo(projectId: string): RepoRow | null {
    const row = db.prepare("SELECT * FROM project_repos WHERE project_id = ?").get(projectId) as
      | RepoRow
      | undefined;
    return row === undefined ? null : row;
  }

  async function requireProjectAccess(
    request: FastifyRequest,
    projectId: string,
  ): Promise<IdentityUser | null> {
    const user = await options.identity.userFrom(request);
    if (user === null) {
      return null;
    }
    if (!userCanAccessProject(projectId, user.id)) {
      return null;
    }
    return user;
  }

  app.get<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/git",
    async (request, reply) => {
      const user = await requireProjectAccess(request, request.params.projectId);
      if (user === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const repo = getRepo(request.params.projectId);
      if (repo === null) {
        return { linked: false };
      }
      const dir = projectDir(options, request.params.projectId);
      let dirty = false;
      let ahead = 0;
      let behind = 0;
      if (existsSync(join(dir, ".git"))) {
        try {
          const status = await runGit(dir, ["status", "--porcelain"]);
          dirty = status.stdout.trim().length > 0;
          const counts = await runGit(dir, [
            "rev-list",
            "--left-right",
            "--count",
            `origin/${repo.default_branch}...HEAD`,
          ]);
          const parts = counts.stdout.trim().split(/\s+/);
          behind = Number.parseInt(parts[0] ?? "0", 10) || 0;
          ahead = Number.parseInt(parts[1] ?? "0", 10) || 0;
        } catch {
          // best-effort — a missing remote branch or fresh clone shouldn't fail the route
        }
      }
      return {
        linked: true,
        owner: repo.github_owner,
        repo: repo.github_repo,
        branch: repo.default_branch,
        dirty,
        ahead,
        behind,
      };
    },
  );

  app.post<{ Params: { projectId: string }; Body: { owner?: unknown; repo?: unknown; branch?: unknown } }>(
    "/api/v1/projects/:projectId/git/link",
    async (request, reply) => {
      const user = await requireProjectAccess(request, request.params.projectId);
      if (user === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const account = options.github.getAccount(user.id);
      const token = options.github.getAccessToken(user.id);
      if (account === null || token === null) {
        return reply.code(409).send({ error: "github not connected" });
      }
      const owner = typeof request.body.owner === "string" ? request.body.owner.trim() : "";
      const repoName = typeof request.body.repo === "string" ? request.body.repo.trim() : "";
      if (owner.length === 0 || repoName.length === 0) {
        return reply.code(400).send({ error: "owner and repo are required" });
      }
      const branch = typeof request.body.branch === "string" && request.body.branch.length > 0
        ? request.body.branch
        : "main";
      if (getRepo(request.params.projectId) !== null) {
        return reply.code(409).send({ error: "a repo is already linked to this project" });
      }
      const dir = projectDir(options, request.params.projectId);
      mkdirSync(dir, { recursive: true });
      if (readdirSync(dir).length > 0) {
        return reply.code(409).send({
          error: "project folder is not empty — clear it before linking a repo",
        });
      }
      try {
        await runGit(
          process.cwd(),
          ["clone", "--branch", branch, "--single-branch", authedRepoUrl(token, owner, repoName), dir],
        );
        // Strip the token back out of the stored remote — it's re-injected fresh on
        // every push/pull instead of sitting in .git/config indefinitely.
        await runGit(dir, ["remote", "set-url", "origin", repoUrl(owner, repoName)]);
      } catch (err) {
        return reply.code(502).send({
          error: `clone failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      db.prepare(
        `INSERT INTO project_repos (project_id, owner_id, github_owner, github_repo, default_branch, linked_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(request.params.projectId, user.id, owner, repoName, branch, Date.now());
      return reply.code(201).send({ linked: true, owner, repo: repoName, branch });
    },
  );

  app.post<{ Params: { projectId: string }; Body: { message?: unknown } }>(
    "/api/v1/projects/:projectId/git/push",
    async (request, reply) => {
      const user = await requireProjectAccess(request, request.params.projectId);
      if (user === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const repo = getRepo(request.params.projectId);
      if (repo === null) {
        return reply.code(409).send({ error: "no repo linked to this project" });
      }
      const token = options.github.getAccessToken(user.id);
      const account = options.github.getAccount(user.id);
      if (token === null || account === null) {
        return reply.code(409).send({ error: "github not connected" });
      }
      const message = typeof request.body.message === "string" && request.body.message.trim().length > 0
        ? request.body.message.trim()
        : "Update from Fookie Cloud";
      const dir = projectDir(options, request.params.projectId);
      const commitEmail = account.email ?? `${account.login}@users.noreply.github.com`;
      try {
        await runGit(dir, ["add", "-A"]);
        try {
          await runGit(dir, [
            "-c",
            `user.name=${account.login}`,
            "-c",
            `user.email=${commitEmail}`,
            "commit",
            "-m",
            message,
          ]);
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          if (!text.includes("nothing to commit")) {
            throw err;
          }
        }
        await runGit(dir, ["remote", "set-url", "origin", authedRepoUrl(token, repo.github_owner, repo.github_repo)]);
        await runGit(dir, ["push", "origin", `HEAD:${repo.default_branch}`]);
      } catch (err) {
        return reply.code(502).send({
          error: `push failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        await runGit(dir, ["remote", "set-url", "origin", repoUrl(repo.github_owner, repo.github_repo)]).catch(
          () => {},
        );
      }
      return { ok: true };
    },
  );

  app.post<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/git/pull",
    async (request, reply) => {
      const user = await requireProjectAccess(request, request.params.projectId);
      if (user === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const repo = getRepo(request.params.projectId);
      if (repo === null) {
        return reply.code(409).send({ error: "no repo linked to this project" });
      }
      const token = options.github.getAccessToken(user.id);
      if (token === null) {
        return reply.code(409).send({ error: "github not connected" });
      }
      const dir = projectDir(options, request.params.projectId);
      try {
        await runGit(dir, ["remote", "set-url", "origin", authedRepoUrl(token, repo.github_owner, repo.github_repo)]);
        await runGit(dir, ["pull", "--ff-only", "origin", repo.default_branch]);
      } catch (err) {
        return reply.code(502).send({
          error: `pull failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        await runGit(dir, ["remote", "set-url", "origin", repoUrl(repo.github_owner, repo.github_repo)]).catch(
          () => {},
        );
      }
      return { ok: true };
    },
  );
}
