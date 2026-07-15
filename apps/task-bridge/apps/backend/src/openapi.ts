/**
 * OpenAPI 3.1 spec for Task Bridge API.
 * Served as raw JSON at GET /api/docs — no UI, AI-friendly.
 *
 * servers.url is "/api", so paths here are relative to that prefix.
 * Full URL = origin + /api + path (e.g. /api/auth/login).
 *
 * All protected routes require: Authorization: Bearer <token>
 */

const UserRole = {
  type: "string",
  enum: ["admin", "read-write", "read"],
} as const;

const User = {
  type: "object",
  required: ["id", "name", "email", "role", "isSystemAdmin"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    email: { type: "string", format: "email" },
    role: { $ref: "#/components/schemas/UserRole" },
    isSystemAdmin: { type: "boolean" },
  },
} as const;

const ErrorBody = {
  type: "object",
  required: ["error"],
  properties: { error: { type: "string" } },
} as const;

const WorkStatus = {
  type: "string",
  enum: ["todo", "in_progress", "done"],
} as const;

const ActorKind = {
  type: "string",
  enum: ["ai", ""],
} as const;

const TaskSummary = {
  type: "object",
  properties: {
    id: { type: "integer" },
    title: { type: "string" },
    projectId: { type: "string" },
    projectName: { type: "string" },
    parentId: { type: "integer", nullable: true },
    stageId: { type: "string", nullable: true },
    assignee: { type: "string", nullable: true },
    createdBy: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    claimedBy: { type: "string", nullable: true },
    claimedAt: { type: "string", nullable: true },
  },
} as const;

const CreatedTaskResponse = {
  type: "object",
  required: ["id", "title", "createdAt", "projectId", "projectName"],
  properties: {
    id: { type: "integer" },
    title: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    projectId: { type: "string" },
    projectName: { type: "string" },
    parentId: { type: "integer", nullable: true },
    stageId: { type: "string", nullable: true },
    assignee: { type: "string", nullable: true },
  },
} as const;

const Member = {
  type: "object",
  required: ["id", "name", "role", "projectId"],
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    name: { type: "string" },
    role: { type: "string" },
    openTasks: { type: "integer" },
  },
} as const;

const TaskTemplate = {
  type: "object",
  required: ["id", "title"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    assigneeRole: { type: "string" },
    assigneeKind: { $ref: "#/components/schemas/ActorKind" },
    kind: { type: "string", enum: ["task", "group"] },
    dependsOn: { type: "array", items: { type: "string" } },
    children: { type: "array", items: { $ref: "#/components/schemas/TaskTemplate" } },
  },
} as const;

const Stage = {
  type: "object",
  required: ["id", "title", "position"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    position: { type: "integer" },
    autoAssignRole: { type: "string" },
    layoutX: { type: "number", nullable: true },
    layoutY: { type: "number", nullable: true },
    spawnTaskCount: { type: "integer" },
    taskTemplates: { type: "array", items: { $ref: "#/components/schemas/TaskTemplate" } },
  },
} as const;

const Workflow = {
  type: "object",
  required: ["projectId", "stages", "roles", "members"],
  properties: {
    projectId: { type: "string" },
    stages: { type: "array", items: { $ref: "#/components/schemas/Stage" } },
    roles: { type: "array", items: { type: "string" } },
    members: { type: "array", items: { $ref: "#/components/schemas/Member" } },
  },
} as const;

const WorkflowTemplate = {
  type: "object",
  required: ["id", "title"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    stages: { type: "array", items: { $ref: "#/components/schemas/Stage" } },
  },
} as const;

const Project = {
  type: "object",
  required: ["id", "name"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    workflowTemplateId: { type: "string" },
  },
} as const;

// ── Reusable response helpers ─────────────────────────────────────────────────

function ok(schema: object) {
  return { "200": { description: "OK", content: { "application/json": { schema } } } };
}
function created(schema: object) {
  return { "201": { description: "Created", content: { "application/json": { schema } } } };
}
function noContent() {
  return { "204": { description: "No Content" } };
}
function err(codes: number[]) {
  const result: Record<string, object> = {};
  for (const code of codes) {
    result[String(code)] = {
      description: ({ 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 409: "Conflict", 500: "Server Error" } as Record<number, string>)[code] || "Error",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
    };
  }
  return result;
}
function json(schema: object) {
  return { required: true, content: { "application/json": { schema } } };
}
function mergeResponses(
  first: Record<string, object>,
  second: Record<string, object> | null = null,
): Record<string, object> {
  const result = Object.assign({}, first);
  if (second !== null) {
    Object.assign(result, second);
  }
  return result;
}

const bearer = [{ bearerAuth: [] }];

// ── Spec ──────────────────────────────────────────────────────────────────────

export const openapiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Task Bridge API",
    version: "1.0.0",
    description:
      "REST API for Task Bridge. Protected routes require `Authorization: Bearer <token>`. " +
      "Tokens are permanent and verified against the DB on every request. " +
      "Get a token via POST /auth/login.",
  },
  servers: [
    { url: "/api", description: "Same-origin API prefix" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
    schemas: {
      UserRole,
      User,
      Error: ErrorBody,
      WorkStatus,
      ActorKind,
      TaskSummary,
      CreatedTaskResponse,
      Member,
      TaskTemplate,
      Stage,
      Workflow,
      WorkflowTemplate,
      Project,
    },
  },
  paths: {
    // ── Auth ──────────────────────────────────────────────────────────────────
    "/auth/status": {
      get: {
        tags: ["auth"],
        summary: "Check if any users exist (first-run detection)",
        security: [],
        responses: ok({ type: "object", required: ["hasUsers"], properties: { hasUsers: { type: "boolean" } } }),
      },
    },
    "/auth/setup": {
      post: {
        tags: ["auth"],
        summary: "Create the initial admin account (only works when no users exist)",
        security: [],
        requestBody: json({
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", minLength: 1 },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
          },
        }),
        responses: mergeResponses(
          created({ type: "object", properties: { user: { $ref: "#/components/schemas/User" }, message: { type: "string" } } }),
          err([409]),
        ),
      },
    },
    "/auth/login": {
      post: {
        tags: ["auth"],
        summary: "Login with email + password → permanent token",
        security: [],
        requestBody: json({
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
        }),
        responses: mergeResponses(
          ok({
            type: "object",
            required: ["token", "user"],
            properties: {
              token: { type: "string", description: "Bearer token — store in localStorage, send in Authorization header" },
              user: { $ref: "#/components/schemas/User" },
            },
          }),
          err([401]),
        ),
      },
    },
    "/auth/me": {
      get: {
        tags: ["auth"],
        summary: "Get the currently authenticated user",
        security: bearer,
        responses: mergeResponses(ok({ $ref: "#/components/schemas/User" }), err([401])),
      },
    },

    // ── Admin: Users ──────────────────────────────────────────────────────────
    "/admin/users": {
      get: {
        tags: ["admin"],
        summary: "List all users (admin only)",
        security: bearer,
        responses: mergeResponses(
          ok({ type: "object", required: ["users"], properties: { users: { type: "array", items: { $ref: "#/components/schemas/User" } } } }),
          err([401, 403]),
        ),
      },
      post: {
        tags: ["admin"],
        summary: "Create a new user (admin only)",
        security: bearer,
        requestBody: json({
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", minLength: 1 },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
            role: { $ref: "#/components/schemas/UserRole" },
          },
        }),
        responses: mergeResponses(
          created({ type: "object", properties: { user: { $ref: "#/components/schemas/User" } } }),
          err([400, 401, 403, 409]),
        ),
      },
    },
    "/admin/users/{userId}": {
      patch: {
        tags: ["admin"],
        summary: "Update user name or role (admin only; system admin role cannot be changed)",
        security: bearer,
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: json({
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            role: { $ref: "#/components/schemas/UserRole" },
          },
        }),
        responses: mergeResponses(
          ok({ type: "object", properties: { user: { $ref: "#/components/schemas/User" } } }),
          err([400, 401, 403, 404]),
        ),
      },
      delete: {
        tags: ["admin"],
        summary: "Delete a user (admin only; system admin cannot be deleted)",
        security: bearer,
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: mergeResponses(noContent(), err([400, 401, 403, 404])),
      },
    },
    "/admin/users/{userId}/token": {
      get: {
        tags: ["admin"],
        summary: "Get a user's bearer token — use for mobile QR code generation (admin only)",
        security: bearer,
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: mergeResponses(
          ok({ type: "object", required: ["token"], properties: { token: { type: "string" } } }),
          err([401, 403, 404]),
        ),
      },
    },

    // ── Projects ──────────────────────────────────────────────────────────────
    "/projects": {
      get: {
        tags: ["projects"],
        summary: "List all projects",
        security: bearer,
        responses: mergeResponses(
          ok({ type: "object", required: ["projects"], properties: { projects: { type: "array", items: { $ref: "#/components/schemas/Project" } } } }),
          err([401]),
        ),
      },
      post: {
        tags: ["projects"],
        summary: "Create a project",
        security: bearer,
        requestBody: json({
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1 },
            id: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", description: "Optional custom slug; auto-generated if omitted" },
            description: { type: "string" },
            workflowTemplateId: { type: "string", description: "Apply a workflow template on creation" },
          },
        }),
        responses: mergeResponses(
          created({ $ref: "#/components/schemas/Project" }),
          err([400, 401, 409]),
        ),
      },
    },

    // ── Epics & Tasks ─────────────────────────────────────────────────────────
    "/epics": {
      post: {
        tags: ["tasks"],
        summary: "Create an epic (top-level task). Use `title` or `text` (text first line = title).",
        security: bearer,
        requestBody: json({
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            text: { type: "string", description: "Alternative: full markdown; first line becomes title" },
          },
        }),
        responses: mergeResponses(created({ $ref: "#/components/schemas/CreatedTaskResponse" }), err([400, 401])),
      },
    },
    "/tasks": {
      get: {
        tags: ["tasks"],
        summary: "List all tasks (epics + subtasks)",
        security: bearer,
        responses: mergeResponses(
          ok({ type: "object", required: ["items"], properties: { items: { type: "array", items: { $ref: "#/components/schemas/TaskSummary" } } } }),
          err([401]),
        ),
      },
      post: {
        tags: ["tasks"],
        summary: "Create a subtask under an epic",
        security: bearer,
        requestBody: json({
          type: "object",
          required: ["parentId", "title"],
          properties: {
            parentId: { type: "integer", description: "ID of parent epic or task" },
            title: { type: "string", minLength: 1 },
            description: { type: "string" },
            stageId: { type: "string" },
          },
        }),
        responses: mergeResponses(created({ $ref: "#/components/schemas/CreatedTaskResponse" }), err([400, 401])),
      },
    },
    "/tasks/{id}": {
      get: {
        tags: ["tasks"],
        summary: "Get task detail (includes comments, work-status, subtasks for epics)",
        security: bearer,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: mergeResponses(ok({ type: "object" }), err([401, 404])),
      },
      patch: {
        tags: ["tasks"],
        summary: "Update task — add a comment or update description (epic only for description)",
        security: bearer,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: json({
          type: "object",
          properties: {
            description: { type: "string" },
            comment: {
              type: "object",
              required: ["text"],
              properties: { text: { type: "string", minLength: 1 }, by: { type: "string", default: "web" } },
            },
          },
        }),
        responses: mergeResponses(ok({ type: "object" }), err([400, 401, 404])),
      },
    },
    "/tasks/{id}/claim": {
      post: {
        tags: ["tasks"],
        summary: "Claim a task for a worker/user",
        security: bearer,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: json({
          type: "object",
          required: ["claimedBy"],
          properties: {
            claimedBy: { type: "string", minLength: 1 },
          },
        }),
        responses: mergeResponses(ok({ type: "object" }), err([401, 404, 409])),
      },
    },
    "/tasks/{id}/unclaim": {
      post: {
        tags: ["tasks"],
        summary: "Release a claimed task",
        security: bearer,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: mergeResponses(
          ok({ type: "object", properties: { taskId: { type: "integer" }, stageId: { type: "string", nullable: true } } }),
          err([401, 404]),
        ),
      },
    },
    "/tasks/{id}/work-status": {
      patch: {
        tags: ["tasks"],
        summary: "Update a subtask's work status (todo → in_progress → done)",
        security: bearer,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: json({
          type: "object",
          required: ["workStatus"],
          properties: {
            workStatus: { $ref: "#/components/schemas/WorkStatus" },
            claimedBy: {
              type: "string",
              description: "Optional audit label; defaults to the authenticated user",
            },
          },
        }),
        responses: mergeResponses(ok({ type: "object" }), err([400, 401, 404])),
      },
    },
    "/projects/{projectId}/epics/{epicId}/tasks": {
      get: {
        tags: ["tasks"],
        summary: "Get an epic's subtask list with stage info",
        security: bearer,
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string" } },
          { name: "epicId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: mergeResponses(ok({ type: "object" }), err([401, 404])),
      },
    },

    // ── Worker queue ──────────────────────────────────────────────────────────
    "/worker/pending": {
      get: {
        tags: ["worker"],
        summary: "List claimable pending tasks (optionally filter by project/role)",
        security: bearer,
        parameters: [
          { name: "projectId", in: "query", schema: { type: "string" } },
          { name: "role", in: "query", schema: { type: "string" } },
          { name: "claimedBy", in: "query", schema: { type: "string" } },
        ],
        responses: mergeResponses(
          ok({ type: "object", required: ["items"], properties: { items: { type: "array", items: { type: "object" } } } }),
          err([401]),
        ),
      },
    },
    "/worker/claim-next": {
      post: {
        tags: ["worker"],
        summary: "Atomically claim the next available task for a role",
        security: bearer,
        requestBody: json({
          type: "object",
          required: ["claimedBy"],
          properties: {
            claimedBy: { type: "string", minLength: 1 },
            projectId: { type: "string" },
          },
        }),
        responses: mergeResponses(ok({ type: "object" }), err([401, 404])),
      },
    },

    // ── Inbox ─────────────────────────────────────────────────────────────────
    "/inbox": {
      get: {
        tags: ["inbox"],
        summary: "Paginated activity feed (comments + status changes)",
        security: bearer,
        parameters: [
          { name: "projectId", in: "query", schema: { type: "string" } },
          { name: "commentsOnly", in: "query", schema: { type: "string", enum: ["true", "false"] } },
          { name: "epicsOnly", in: "query", schema: { type: "string", enum: ["true", "false"] } },
          { name: "cursor", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
        ],
        responses: mergeResponses(ok({ type: "object" }), err([401])),
      },
    },

    // ── Workflow ──────────────────────────────────────────────────────────────
    "/projects/{projectId}/workflow": {
      get: {
        tags: ["workflow"],
        summary: "Get a project's workflow (stages + members + roles)",
        security: bearer,
        parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }],
        responses: mergeResponses(ok({ $ref: "#/components/schemas/Workflow" }), err([401, 404])),
      },
      put: {
        tags: ["workflow"],
        summary: "Replace a project's entire workflow",
        security: bearer,
        parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: json({
          type: "object",
          required: ["stages"],
          properties: {
            stages: { type: "array", items: { $ref: "#/components/schemas/Stage" }, minItems: 1 },
            roles: { type: "array", items: { type: "string" } },
          },
        }),
        responses: mergeResponses(ok({ $ref: "#/components/schemas/Workflow" }), err([400, 401, 404])),
      },
    },
    "/projects/{projectId}/workflow/export": {
      get: {
        tags: ["workflow"],
        summary: "Export workflow in human-readable format",
        security: bearer,
        parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }],
        responses: mergeResponses(ok({ type: "object" }), err([401, 404])),
      },
    },
    "/projects/{projectId}/workflow/apply-template": {
      post: {
        tags: ["workflow"],
        summary: "Apply a workflow template to a project (replaces existing workflow)",
        security: bearer,
        parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: json({ type: "object", required: ["templateId"], properties: { templateId: { type: "string", minLength: 1 } } }),
        responses: mergeResponses(ok({ $ref: "#/components/schemas/Workflow" }), err([400, 401, 404])),
      },
    },

    // ── Project Members ───────────────────────────────────────────────────────
    "/projects/{projectId}/members": {
      get: {
        tags: ["workflow"],
        summary: "List project members (workflow participants)",
        security: bearer,
        parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }],
        responses: mergeResponses(
          ok({ type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Member" } } } }),
          err([401, 404]),
        ),
      },
      post: {
        tags: ["workflow"],
        summary: "Add a member to a project",
        security: bearer,
        parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: json({
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1 },
            role: { type: "string" },
          },
        }),
        responses: mergeResponses(created({ $ref: "#/components/schemas/Member" }), err([400, 401, 404])),
      },
    },
    "/projects/{projectId}/members/{memberId}": {
      patch: {
        tags: ["workflow"],
        summary: "Update a project member",
        security: bearer,
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string" } },
          { name: "memberId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: json({
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            role: { type: "string" },
          },
        }),
        responses: mergeResponses(ok({ $ref: "#/components/schemas/Member" }), err([401, 404])),
      },
      delete: {
        tags: ["workflow"],
        summary: "Remove a member from a project",
        security: bearer,
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string" } },
          { name: "memberId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: mergeResponses(noContent(), err([401, 404])),
      },
    },

    // ── Workflow Templates ────────────────────────────────────────────────────
    "/workflow-templates": {
      get: {
        tags: ["workflow-templates"],
        summary: "List all workflow templates",
        security: bearer,
        responses: mergeResponses(
          ok({ type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/WorkflowTemplate" } } } }),
          err([401]),
        ),
      },
      post: {
        tags: ["workflow-templates"],
        summary: "Create a new workflow template (one starter stage — customize via PUT)",
        security: bearer,
        requestBody: json({
          type: "object",
          required: ["title"],
          properties: {
            id: { type: "string", description: "Optional custom ID; auto-generated if omitted" },
            title: { type: "string", minLength: 1 },
            description: { type: "string" },
          },
        }),
        responses: mergeResponses(created({ $ref: "#/components/schemas/WorkflowTemplate" }), err([400, 401])),
      },
    },
    "/workflow-templates/import": {
      post: {
        tags: ["workflow-templates"],
        summary: "Import a template from a previously exported JSON file. ID is reused if free, otherwise auto-suffixed.",
        security: bearer,
        requestBody: json({
          type: "object",
          required: ["title", "stages"],
          properties: {
            id: { type: "string", description: "Preferred ID (hint — may be suffixed if already taken)" },
            title: { type: "string", minLength: 1 },
            description: { type: "string" },
            stages: { type: "array", items: { $ref: "#/components/schemas/Stage" }, minItems: 1 },
            exportedFrom: { type: "string", description: "Ignored — present in export files for identification" },
            version: { type: "integer", description: "Ignored — present in export files for versioning" },
          },
        }),
        responses: mergeResponses(created({ $ref: "#/components/schemas/WorkflowTemplate" }), err([400, 401])),
      },
    },
    "/workflow-templates/{templateId}": {
      get: {
        tags: ["workflow-templates"],
        summary: "Get a workflow template by ID",
        security: bearer,
        parameters: [{ name: "templateId", in: "path", required: true, schema: { type: "string" } }],
        responses: mergeResponses(ok({ $ref: "#/components/schemas/WorkflowTemplate" }), err([401, 404])),
      },
      put: {
        tags: ["workflow-templates"],
        summary: "Replace a workflow template's stages",
        security: bearer,
        parameters: [{ name: "templateId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: json({
          type: "object",
          required: ["stages"],
          properties: {
            stages: { type: "array", items: { $ref: "#/components/schemas/Stage" }, minItems: 1 },
          },
        }),
        responses: mergeResponses(ok({ $ref: "#/components/schemas/WorkflowTemplate" }), err([400, 401, 404])),
      },
    },
    "/workflow-templates/{templateId}/export": {
      get: {
        tags: ["workflow-templates"],
        summary: "Download a template as a JSON file (Content-Disposition: attachment)",
        security: bearer,
        parameters: [{ name: "templateId", in: "path", required: true, schema: { type: "string" } }],
        responses: mergeResponses(
          {
            "200": {
              description: "JSON file download",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["exportedFrom", "version", "id", "title", "stages"],
                    properties: {
                      exportedFrom: { type: "string", example: "task-bridge" },
                      version: { type: "integer", example: 1 },
                      id: { type: "string" },
                      title: { type: "string" },
                      description: { type: "string" },
                      stages: { type: "array", items: { $ref: "#/components/schemas/Stage" } },
                    },
                  },
                },
              },
            },
          },
          err([401, 404]),
        ),
      },
    },
  },
} as const;
