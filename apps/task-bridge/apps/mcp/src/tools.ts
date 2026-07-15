import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TaskBridgeApi } from "./api-client.js";
import { TaskBridgeApiError } from "./api-client.js";
import { jsonToolResult, toolError } from "./result.js";

const workStatusSchema = z.enum(["todo", "in_progress", "done"]);

async function runTool<T>(handler: () => Promise<T>) {
  try {
    const value = await handler();
    return jsonToolResult(value as object);
  } catch (error) {
    if (error instanceof TaskBridgeApiError) {
      return toolError(`API ${error.status}: ${error.message}`);
    }
    if (error instanceof Error) {
      return toolError(error.message);
    }
    return toolError(String(error));
  }
}

export function registerTools(server: McpServer, api: TaskBridgeApi) {
  server.tool(
    "get_me",
    "Return the authenticated Task Bridge user.",
    {},
    async () => runTool(() => api.get("/api/auth/me")),
  );

  server.tool(
    "list_projects",
    "List all projects.",
    {},
    async () => runTool(() => api.get("/api/projects")),
  );

  server.tool(
    "create_project",
    "Create a project.",
    {
      name: z.string().min(1),
      id: z.string().nullable(),
      workflowTemplateId: z.string().nullable(),
    },
    async (input) =>
      runTool(() => {
        const body: Record<string, string> = {
          name: input.name,
        };
        if (input.id !== null) {
          body.id = input.id;
        }
        if (input.workflowTemplateId !== null) {
          body.workflowTemplateId = input.workflowTemplateId;
        }
        return api.post("/api/projects", body);
      }),
  );

  server.tool(
    "get_workflow",
    "Get a project's workflow (stages, roles, members).",
    {
      projectId: z.string().min(1),
    },
    async (input) => runTool(() => api.get(`/api/projects/${input.projectId}/workflow`)),
  );

  server.tool(
    "export_workflow",
    "Export a project workflow in human-readable form.",
    {
      projectId: z.string().min(1),
    },
    async (input) => runTool(() => api.get(`/api/projects/${input.projectId}/workflow/export`)),
  );

  server.tool(
    "list_project_members",
    "List workflow members for a project.",
    {
      projectId: z.string().min(1),
    },
    async (input) => runTool(() => api.get(`/api/projects/${input.projectId}/members`)),
  );

  server.tool(
    "create_epic",
    "Create a top-level epic in a project. Use title or text (first line becomes title).",
    {
      projectId: z.string().min(1),
      title: z.string().nullable(),
      description: z.string().nullable(),
      text: z.string().nullable(),
    },
    async (input) =>
      runTool(() => {
        const body: Record<string, string> = {
          projectId: input.projectId,
        };
        if (input.title !== null) {
          body.title = input.title;
        }
        if (input.description !== null) {
          body.description = input.description;
        }
        if (input.text !== null) {
          body.text = input.text;
        }
        return api.post("/api/epics", body);
      }),
  );

  server.tool(
    "create_task",
    "Create a subtask under an epic or parent task.",
    {
      parentId: z.number().int().positive(),
      title: z.string().min(1),
      description: z.string().nullable(),
      stageId: z.string().nullable(),
    },
    async (input) =>
      runTool(() => {
        const body: Record<string, string | number> = {
          parentId: input.parentId,
          title: input.title,
        };
        if (input.description !== null) {
          body.description = input.description;
        }
        if (input.stageId !== null) {
          body.stageId = input.stageId;
        }
        return api.post("/api/tasks", body);
      }),
  );

  server.tool(
    "list_tasks",
    "List all tasks (epics and subtasks).",
    {},
    async () => runTool(() => api.get("/api/tasks")),
  );

  server.tool(
    "get_task",
    "Get full task detail including comments, work status, and subtasks.",
    {
      taskId: z.number().int().positive(),
    },
    async (input) => runTool(() => api.get(`/api/tasks/${input.taskId}`)),
  );

  server.tool(
    "list_epic_tasks",
    "List subtasks for an epic with stage info.",
    {
      projectId: z.string().min(1),
      epicId: z.number().int().positive(),
    },
    async (input) =>
      runTool(() => api.get(`/api/projects/${input.projectId}/epics/${input.epicId}/tasks`)),
  );

  server.tool(
    "get_task_context",
    "Get packed agent context: description, brief, comments, epic/parent summary, workflow state.",
    {
      taskId: z.number().int().positive(),
    },
    async (input) => runTool(() => api.get(`/api/tasks/${input.taskId}/context`)),
  );

  server.tool(
    "update_task_brief",
    "Set or append the living brief for a task (agent decisions summary).",
    {
      taskId: z.number().int().positive(),
      brief: z.string().nullable(),
      append: z.string().nullable(),
    },
    async (input) =>
      runTool(() => {
        const body: Record<string, string> = {};
        if (input.brief !== null) {
          body.brief = input.brief;
        }
        if (input.append !== null) {
          body.append = input.append;
        }
        return api.patch(`/api/tasks/${input.taskId}/brief`, body);
      }),
  );

  server.tool(
    "complete_task",
    "Mark a subtask done, append summary/PR to brief, unclaim, return epic stage and next claimable task.",
    {
      taskId: z.number().int().positive(),
      summary: z.string().nullable(),
      prUrl: z.string().nullable(),
    },
    async (input) =>
      runTool(() => {
        const body: Record<string, string> = {};
        if (input.summary !== null && input.summary.trim().length > 0) {
          body.summary = input.summary.trim();
        }
        if (input.prUrl !== null && input.prUrl.trim().length > 0) {
          body.prUrl = input.prUrl.trim();
        }
        return api.post(`/api/tasks/${input.taskId}/complete`, body);
      }),
  );

  server.tool(
    "add_comment",
    "Add a comment to a task. Use role=system for agent notes (does not release claim).",
    {
      taskId: z.number().int().positive(),
      text: z.string().min(1),
      by: z.string().nullable(),
      role: z.enum(["user", "system"]).nullable(),
      tags: z.array(z.string()).nullable(),
    },
    async (input) =>
      runTool(() => {
        const comment: Record<string, string | string[]> = {
          text: input.text,
        };
        if (input.by !== null) {
          comment.by = input.by;
        } else {
          comment.by = "mcp";
        }
        if (input.role !== null) {
          comment.role = input.role;
        }
        if (input.tags !== null) {
          comment.tags = input.tags;
        }
        return api.patch(`/api/tasks/${input.taskId}`, { comment });
      }),
  );

  server.tool(
    "update_task_description",
    "Update an epic description.",
    {
      taskId: z.number().int().positive(),
      description: z.string(),
    },
    async (input) =>
      runTool(() => api.patch(`/api/tasks/${input.taskId}`, { description: input.description })),
  );

  server.tool(
    "update_work_status",
    "Update a subtask work status: todo, in_progress, or done. Assignment/claim is not required.",
    {
      taskId: z.number().int().positive(),
      workStatus: workStatusSchema,
      claimedBy: z.string().nullable(),
    },
    async (input) =>
      runTool(() => {
        const body: { workStatus: string; claimedBy?: string } = {
          workStatus: input.workStatus,
        };
        if (input.claimedBy !== null && input.claimedBy.trim() !== "") {
          body.claimedBy = input.claimedBy.trim();
        }
        return api.patch(`/api/tasks/${input.taskId}/work-status`, body);
      }),
  );

  server.tool(
    "claim_task",
    "Claim a specific task as a project member.",
    {
      taskId: z.number().int().positive(),
      claimedBy: z.string().nullable(),
    },
    async (input) =>
      runTool(() => {
        let claimedBy = "mcp";
        if (input.claimedBy !== null) {
          claimedBy = input.claimedBy;
        }
        return api.post(`/api/tasks/${input.taskId}/claim`, { claimedBy });
      }),
  );

  server.tool(
    "unclaim_task",
    "Release a claimed task.",
    {
      taskId: z.number().int().positive(),
    },
    async (input) => runTool(() => api.post(`/api/tasks/${input.taskId}/unclaim`, null)),
  );

  server.tool(
    "list_worker_pending",
    "List claimable pending tasks for a worker.",
    {
      projectId: z.string().nullable(),
      claimedBy: z.string().nullable(),
    },
    async (input) =>
      runTool(() => {
        const query: Record<string, string | null> = {
          projectId: input.projectId,
          claimedBy: input.claimedBy,
        };
        return api.get("/api/worker/pending", query);
      }),
  );

  server.tool(
    "claim_next_task",
    "Atomically claim the next available task for a project member.",
    {
      projectId: z.string().min(1),
      claimedBy: z.string().nullable(),
    },
    async (input) =>
      runTool(() => {
        let claimedBy = "mcp";
        if (input.claimedBy !== null) {
          claimedBy = input.claimedBy;
        }
        return api.post("/api/worker/claim-next", {
          projectId: input.projectId,
          claimedBy,
        });
      }),
  );

  server.tool(
    "list_inbox",
    "Paginated inbox feed (comments and activity).",
    {
      projectId: z.string().nullable(),
      commentsOnly: z.boolean().nullable(),
      epicsOnly: z.boolean().nullable(),
      cursor: z.string().nullable(),
      limit: z.number().int().min(1).max(100).nullable(),
    },
    async (input) =>
      runTool(() => {
        const query: Record<string, string | number | boolean | null> = {
          projectId: input.projectId,
          cursor: input.cursor,
          limit: input.limit,
        };
        if (input.commentsOnly === true) {
          query.commentsOnly = "true";
        }
        if (input.epicsOnly === true) {
          query.epicsOnly = "true";
        }
        return api.get("/api/inbox", query);
      }),
  );

  server.tool(
    "list_workflow_templates",
    "List workflow templates.",
    {},
    async () => runTool(() => api.get("/api/workflow-templates")),
  );

  server.tool(
    "get_workflow_template",
    "Get a workflow template by id.",
    {
      templateId: z.string().min(1),
    },
    async (input) => runTool(() => api.get(`/api/workflow-templates/${input.templateId}`)),
  );

  server.tool(
    "list_library_sync",
    "List project library files for sync. Each item has id, contentHash, sizeBytes, updatedAt. Compare hashes to find missing or outdated local files.",
    {
      projectId: z.string().min(1),
      libraryId: z.string().nullable(),
    },
    async (input) =>
      runTool(() => {
        const query: Record<string, string | null> = { libraryId: null };
        if (input.libraryId !== null && input.libraryId.trim() !== "") {
          query.libraryId = input.libraryId.trim();
        }
        return api.get(`/api/projects/${input.projectId}/library/sync`, query);
      }),
  );

  server.tool(
    "list_libraries",
    "List library folders for a project.",
    {
      projectId: z.string().min(1),
    },
    async (input) => runTool(() => api.get(`/api/projects/${input.projectId}/libraries`)),
  );

  server.tool(
    "get_library",
    "Get a library folder and its files.",
    {
      projectId: z.string().min(1),
      libraryId: z.string().min(1),
    },
    async (input) =>
      runTool(() => api.get(`/api/projects/${input.projectId}/libraries/${input.libraryId}`)),
  );

  server.tool(
    "download_library_document",
    "Download a library file. Returns base64 content plus filename, mime, hash, size.",
    {
      documentId: z.string().min(1),
    },
    async (input) =>
      runTool(() => api.getBinary(`/api/library-documents/${input.documentId}/content`)),
  );
}
