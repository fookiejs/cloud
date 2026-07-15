import { countSpawnableTemplates } from "../domain/task-template-graph.js";
import { DEFAULT_WORKFLOW_TEMPLATE_ID } from "../domain/workflow-template-id.js";
import type { StageTaskTemplate } from "../domain/workflow-stage.js";
import { serializeTaskTemplates } from "../domain/workflow-stage.js";
import { getProjectsDb } from "./projects-db.js";

export type WorkflowTemplateRow = {
  id: string;
  title: string;
  description: string;
  owner_user_id: string | null;
  updated_at: string;
};

export type WorkflowTemplateStageRow = {
  template_id: string;
  id: string;
  title: string;
  description: string;
  purpose: string;
  rules_json: string;
  position: number;
  auto_assign: number;
  layout_x: number | null;
  layout_y: number | null;
  spawn_task_count: number;
  task_templates_json: string;
};

type TemplateStageSeed = {
  id: string;
  title: string;
  description: string;
  purpose: string;
  rules: string[];
  position: number;
  autoAssign: boolean;
  taskTemplates: StageTaskTemplate[] | null;
};

type TemplateSeed = {
  id: string;
  title: string;
  description: string;
  stages: TemplateStageSeed[];
};

const DEPRECATED_TEMPLATE_IDS = [
  "empty",
  "ai-sdlc",
  "go",
  "nodejs",
  "sdlc-classic",
  "scrum-sprint",
  "devops-cicd",
  "agentic-engineering",
  "senior-team",
  "software-team",
  "spec-review-gate",
  "plan-decompose",
  "ready-for-pr",
  "review-security",
];

function task(
  id: string,
  title: string,
  description = "",
  assigneeRole = "",
  children: StageTaskTemplate[] = [],
  dependsOn: string[] = [],
): StageTaskTemplate {
  return {
    id,
    title,
    description,
    assigneeRole: assigneeRole || null,
    dependsOn,
    children,
  };
}

const DEFAULT_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    id: DEFAULT_WORKFLOW_TEMPLATE_ID,
    title: "Plan · Build · Deliver",
    description: "Simple three-stage pipeline. Plan the work, build it, then deliver.",
    stages: [
      {
        id: "plan",
        title: "Plan",
        description: "Define what to build and how to approach it.",
        purpose: "Scope",
        rules: ["Scope clear", "Approach agreed"],
        position: 0,
        autoAssign: false,
        taskTemplates: [
          task(
            "pl-scope",
            "Define scope and approach",
            "**Output:** what to build and how.",
          ),
        ],
      },
      {
        id: "build",
        title: "Build",
        description: "Implement the change.",
        purpose: "Implementation",
        rules: ["Change implemented"],
        position: 1,
        autoAssign: false,
        taskTemplates: [
          task(
            "bd-implement",
            "Implement the change",
            "**Output:** working change ready for review.",
          ),
        ],
      },
      {
        id: "deliver",
        title: "Deliver",
        description: "Ship and verify the outcome.",
        purpose: "Release",
        rules: ["Change verified", "Outcome delivered"],
        position: 2,
        autoAssign: false,
        taskTemplates: [
          task(
            "dl-ship",
            "Ship and verify",
            "**Output:** change deployed and verified.",
          ),
        ],
      },
    ],
  },
  {
    id: "general-work",
    title: "General Work",
    description: `Coarse loop for any kind of work (not code-only).

Research -> Debate -> Check -> Critique -> Deliver.

One task per stage. Deliverables follow the epic text (PR, Library, docs, etc.). No calendar estimates.`,
    stages: [
      {
        id: "research",
        title: "Research",
        description: `## Objective
Internet and prior-art research for the epic.

## Exit
You understand how others solved this and what matters for this epic.`,
        purpose: "Internet research",
        rules: ["Sources gathered", "Approaches compared", "No calendar estimates"],
        position: 0,
        autoAssign: false,
        taskTemplates: [
          task(
            "gw-research",
            "Internet research",
            "**Output:** research notes in the task brief.\n\n- Search the web, docs, repos, and forums\n- Capture useful approaches and trade-offs\n- Match the language of the epic\n- Do not invent day/week timelines",
          ),
        ],
      },
      {
        id: "debate",
        title: "Debate",
        description: `## Objective
Argue the options against each other before committing.

## Exit
A clear recommendation with risks.`,
        purpose: "Internal debate",
        rules: ["Options weighed", "Risks named", "Recommendation made"],
        position: 1,
        autoAssign: false,
        taskTemplates: [
          task(
            "gw-debate",
            "Internal debate",
            "**Output:** debate notes in the task brief.\n\n- Compare options using prior research\n- Call out risks and unknowns\n- Recommend a path (code change not required unless the epic needs it)",
          ),
        ],
      },
      {
        id: "check",
        title: "Check",
        description: `## Objective
Verify the work-in-progress against the epic goal.

## Exit
Gaps and pass/fail notes are written.`,
        purpose: "Work check",
        rules: ["Evidence checked", "Gaps listed"],
        position: 2,
        autoAssign: false,
        taskTemplates: [
          task(
            "gw-check",
            "Work check",
            "**Output:** verification notes in the task brief.\n\n- Check claims against the repo and sources\n- List what holds and what is missing",
          ),
        ],
      },
      {
        id: "critique",
        title: "Critique",
        description: `## Objective
Critically review quality, simplicity, and failure points.

## Exit
Actionable critique is written.`,
        purpose: "Critique",
        rules: ["Weak points named", "Improvements proposed"],
        position: 3,
        autoAssign: false,
        taskTemplates: [
          task(
            "gw-critique",
            "Critique",
            "**Output:** critique in the task brief.\n\n- What is wrong, fragile, or overbuilt\n- What to simplify or fix next",
          ),
        ],
      },
      {
        id: "deliver",
        title: "Deliver",
        description: `## Objective
Ship the epic outcome only as requested (PR and/or Library and/or notes).

## Exit
Requested delivery is done; brief holds the summary.`,
        purpose: "Delivery",
        rules: ["Follow epic delivery asks", "Brief updated"],
        position: 4,
        autoAssign: false,
        taskTemplates: [
          task(
            "gw-deliver",
            "Deliver outcome",
            "**Output:** final delivery summary in the task brief.\n\n- If the epic asks for a PR, open a PR\n- If the epic asks for Library, add Library docs\n- Otherwise write the final notes only\n- Match the epic language; no calendar estimates",
          ),
        ],
      },
    ],
  },
  {
    id: "lean-sdlc",
    title: "Lean SDLC",
    description: `Lean, classic software delivery pipeline.

Research -> Define -> Design -> Implement -> Review -> Verify -> Done.

No branches, no PRs, no AI gates: build the change, then review the diff directly. Customize stages on the Pipeline tab.`,
    stages: [
      {
        id: "research",
        title: "Research",
        description: `## Objective
Learn from prior art before committing to a solution.

## Exit
You know how others solved this, with concrete references, examples, and known pitfalls.`,
        purpose: "Prior art",
        rules: ["Similar solutions reviewed", "References collected", "Pitfalls noted"],
        position: 0,
        autoAssign: false,
        taskTemplates: [
          task(
            "rs-similar",
            "Find how others solved this",
            "**Output:** short notes on existing approaches.\n\n- Search the web, forums, and repos for similar work\n- Capture 2-3 approaches and their trade-offs",
          ),
          task(
            "rs-examples",
            "Collect code examples",
            "**Output:** a list of reference snippets and libraries.\n\n- Gather relevant examples and reusable libraries\n- Note license and fit",
          ),
          task(
            "rs-docs",
            "Gather official docs and references",
            "**Output:** links to authoritative docs.\n\n- Official docs, specs, and API references for the tools involved",
          ),
          task(
            "rs-opinions",
            "Collect community opinions and pitfalls",
            "**Output:** list of gotchas.\n\n- Issues, threads, and comments from people who built this\n- What broke for them and what they would do differently",
          ),
        ],
      },
      {
        id: "define",
        title: "Define",
        description: `## Objective
Turn the request into a clear, testable spec.

## Exit
Problem, acceptance criteria, and scope are written down.`,
        purpose: "Spec",
        rules: ["Problem statement written", "Acceptance criteria defined", "Scope explicit"],
        position: 1,
        autoAssign: false,
        taskTemplates: [
          task(
            "df-problem",
            "Write problem statement",
            "**Output:** one paragraph on who has the problem and why it matters.",
            "",
            [
              task(
                "df-criteria",
                "Define acceptance criteria",
                "**Output:** checklist of conditions that mean done.",
              ),
              task(
                "df-scope",
                "Set scope and out-of-scope",
                "**Output:** what is in and what is explicitly out.",
              ),
              task(
                "df-priority",
                "Prioritize and size",
                "**Output:** rough size and priority versus other work.",
              ),
            ],
          ),
        ],
      },
      {
        id: "design",
        title: "Design",
        description: `## Objective
Decide how to build it before writing code.

## Exit
A technical approach and a task breakdown exist.`,
        purpose: "Plan",
        rules: ["Approach chosen", "Data/API impact known", "Work broken down"],
        position: 2,
        autoAssign: false,
        taskTemplates: [
          task(
            "ds-approach",
            "Choose technical approach",
            "**Output:** short design note describing the chosen approach.",
            "",
            [
              task(
                "ds-data",
                "Define data model and API changes",
                "**Output:** schema, types, or endpoint changes.",
                "",
                [
                  task(
                    "ds-risks",
                    "List risks and dependencies",
                    "**Output:** risks, unknowns, and what this depends on.",
                    "",
                    [
                      task(
                        "ds-breakdown",
                        "Break work into tasks",
                        "**Output:** ordered list of implementation steps.",
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      },
      {
        id: "implement",
        title: "Implement",
        description: `## Objective
Build the change.

## Exit
Change is complete and passes local checks.`,
        purpose: "Build",
        rules: ["Change implemented", "Tests added/updated", "Local checks pass"],
        position: 3,
        autoAssign: false,
        taskTemplates: [
          task(
            "im-core",
            "Implement the change",
            "**Output:** working code for the feature or fix.",
            "",
            [
              task(
                "im-tests",
                "Add or update tests",
                "**Output:** tests covering the new behavior.",
                "",
                [
                  task(
                    "im-docs",
                    "Update docs and config",
                    "**Output:** updated docs, config, or examples.",
                    "",
                    [
                      task(
                        "im-selfcheck",
                        "Run local checks",
                        "**Output:** lint, typecheck, and build all pass locally.",
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      },
      {
        id: "review",
        title: "Review",
        description: `## Objective
Review the change directly. No PR, no branch ceremony.

## Exit
The diff has been read and acceptance criteria are met.`,
        purpose: "Review diff",
        rules: ["Diff reviewed", "Criteria met", "Feedback applied"],
        position: 4,
        autoAssign: false,
        taskTemplates: [
          task(
            "rv-diff",
            "Review the change set",
            "**Output:** notes from reading the full diff.",
            "",
            [
              task(
                "rv-criteria",
                "Verify acceptance criteria",
                "**Output:** each criterion checked against the change.",
                "",
                [
                  task(
                    "rv-feedback",
                    "Apply review feedback",
                    "**Output:** fixes for issues found in review.",
                  ),
                ],
              ),
            ],
          ),
        ],
      },
      {
        id: "verify",
        title: "Verify",
        description: `## Objective
Confirm it works and nothing else broke.

## Exit
Tests pass and behavior is verified.`,
        purpose: "QA",
        rules: ["Test suite green", "Behavior verified", "No regressions"],
        position: 5,
        autoAssign: false,
        taskTemplates: [
          task(
            "vf-suite",
            "Run the test suite",
            "**Output:** full test run is green.",
            "",
            [
              task(
                "vf-manual",
                "Manual and exploratory test",
                "**Output:** notes from trying the change by hand.",
                "",
                [
                  task(
                    "vf-regression",
                    "Regression check",
                    "**Output:** confirm related features still work.",
                  ),
                ],
              ),
            ],
          ),
        ],
      },
      {
        id: "done",
        title: "Done",
        description: `## Objective
Wrap up and record what shipped.

## Exit
Change is integrated and noted.`,
        purpose: "Closed",
        rules: ["Change integrated", "Notes updated"],
        position: 6,
        autoAssign: false,
        taskTemplates: [
          task(
            "dn-apply",
            "Integrate the change",
            "**Output:** change merged or applied to the main line of work.",
            "",
            [
              task(
                "dn-notes",
                "Update changelog and notes",
                "**Output:** short note of what changed and why.",
                "",
                [
                  task(
                    "dn-close",
                    "Close out and record learnings",
                    "**Output:** capture anything worth remembering next time.",
                  ),
                ],
              ),
            ],
          ),
        ],
      },
    ],
  },
];

function removeDeprecatedTemplates() {
  migrateWorkflowTemplateTables();
  const db = getProjectsDb();
  db.prepare(
    "UPDATE projects SET workflow_template_id = ? WHERE workflow_template_id = 'empty'",
  ).run(DEFAULT_WORKFLOW_TEMPLATE_ID);
  for (const id of DEPRECATED_TEMPLATE_IDS) {
    deleteWorkflowTemplateStages(id);
    db.prepare("DELETE FROM workflow_templates WHERE id = ?").run(id);
  }
}

function insertTemplateStages(template: TemplateSeed) {
  for (const stage of template.stages) {
    let taskTemplates: StageTaskTemplate[] = [];
    if (stage.taskTemplates !== null) {
      taskTemplates = stage.taskTemplates;
    }
    insertWorkflowTemplateStageRow({
      templateId: template.id,
      id: stage.id,
      title: stage.title,
      description: stage.description,
      purpose: stage.purpose,
      rulesJson: JSON.stringify(stage.rules),
      position: stage.position,
      autoAssign: stage.autoAssign,
      spawnTaskCount: countSpawnableTemplates(taskTemplates),
      taskTemplatesJson: serializeTaskTemplates(taskTemplates),
      layoutX: null,
      layoutY: null,
    });
  }
}

function upsertBuiltinTemplate(template: TemplateSeed) {
  if (template.id === DEFAULT_WORKFLOW_TEMPLATE_ID) {
    const existing = listWorkflowTemplateRows({ id: template.id });
    if (existing.length > 0) {
      deleteWorkflowTemplateStages(template.id);
      getProjectsDb()
        .prepare("UPDATE workflow_templates SET title = ?, description = ?, updated_at = datetime('now') WHERE id = ?")
        .run(template.title, template.description, template.id);
    } else {
      insertWorkflowTemplateRow({
        id: template.id,
        title: template.title,
        description: template.description,
      });
    }
    insertTemplateStages(template);
    return;
  }
  const existing = listWorkflowTemplateRows({ id: template.id });
  if (existing.length > 0) return;
  insertWorkflowTemplateRow({
    id: template.id,
    title: template.title,
    description: template.description,
  });
  insertTemplateStages(template);
}

export function migrateWorkflowTemplateTables() {
  const db = getProjectsDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workflow_template_stages (
      template_id TEXT NOT NULL,
      id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      purpose TEXT NOT NULL DEFAULT '',
      rules_json TEXT NOT NULL DEFAULT '[]',
      position INTEGER NOT NULL DEFAULT 0,
      auto_assign INTEGER NOT NULL DEFAULT 0,
      layout_x REAL,
      layout_y REAL,
      spawn_task_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (template_id, id)
    );

    CREATE INDEX IF NOT EXISTS idx_workflow_template_stages_template
      ON workflow_template_stages(template_id);
  `);

  const columns = db.prepare("PRAGMA table_info(workflow_template_stages)").all() as { name: string }[];
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("task_templates_json")) {
    db.exec("ALTER TABLE workflow_template_stages ADD COLUMN task_templates_json TEXT NOT NULL DEFAULT '[]'");
  }
  const templateColumns = db.prepare("PRAGMA table_info(workflow_templates)").all() as { name: string }[];
  const templateNames = new Set(templateColumns.map((column) => column.name));
  if (!templateNames.has("owner_user_id")) {
    db.exec("ALTER TABLE workflow_templates ADD COLUMN owner_user_id TEXT");
  }
}

export function countWorkflowTemplates(): number {
  migrateWorkflowTemplateTables();
  const row = getProjectsDb()
    .prepare("SELECT COUNT(*) AS count FROM workflow_templates")
    .get() as { count: number };
  return row.count;
}

export function listWorkflowTemplateRows(filter: { id: string }): WorkflowTemplateRow[] {
  migrateWorkflowTemplateTables();
  const id = filter.id;
  if (id !== "") {
    return getProjectsDb()
      .prepare(
        "SELECT id, title, description, owner_user_id, updated_at FROM workflow_templates WHERE id = ?",
      )
      .all(id) as WorkflowTemplateRow[];
  }
  return getProjectsDb()
    .prepare(
      "SELECT id, title, description, owner_user_id, updated_at FROM workflow_templates ORDER BY title COLLATE NOCASE ASC",
    )
    .all() as WorkflowTemplateRow[];
}

export function listWorkflowTemplateRowsForOwner(ownerUserId: string): WorkflowTemplateRow[] {
  migrateWorkflowTemplateTables();
  return getProjectsDb()
    .prepare(
      `SELECT id, title, description, owner_user_id, updated_at
       FROM workflow_templates
       WHERE owner_user_id = ?
       ORDER BY title COLLATE NOCASE ASC`,
    )
    .all(ownerUserId) as WorkflowTemplateRow[];
}

export function getWorkflowTemplateOwner(templateId: string): string | null {
  migrateWorkflowTemplateTables();
  const row = getProjectsDb()
    .prepare("SELECT owner_user_id FROM workflow_templates WHERE id = ?")
    .get(templateId) as { owner_user_id: string | null } | undefined;
  return row?.owner_user_id ?? null;
}

export function setWorkflowTemplateOwner(templateId: string, ownerUserId: string) {
  migrateWorkflowTemplateTables();
  getProjectsDb()
    .prepare("UPDATE workflow_templates SET owner_user_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(ownerUserId, templateId);
}

export function listWorkflowTemplateStageRows(templateId: string): WorkflowTemplateStageRow[] {
  migrateWorkflowTemplateTables();
  return getProjectsDb()
    .prepare(
      `SELECT template_id, id, title, description, purpose, rules_json, position, auto_assign, layout_x, layout_y, spawn_task_count, task_templates_json
       FROM workflow_template_stages WHERE template_id = ? ORDER BY position ASC, title COLLATE NOCASE ASC`,
    )
    .all(templateId) as WorkflowTemplateStageRow[];
}

export function deleteWorkflowTemplateStages(templateId: string) {
  migrateWorkflowTemplateTables();
  getProjectsDb()
    .prepare("DELETE FROM workflow_template_stages WHERE template_id = ?")
    .run(templateId);
}

export function deleteWorkflowTemplateRow(templateId: string): boolean {
  migrateWorkflowTemplateTables();
  const id = templateId;
  deleteWorkflowTemplateStages(id);
  const result = getProjectsDb().prepare("DELETE FROM workflow_templates WHERE id = ?").run(id);
  return result.changes > 0;
}

export function insertWorkflowTemplateRow(row: {
  id: string;
  title: string;
  description: string;
  ownerUserId?: string | null;
}) {
  migrateWorkflowTemplateTables();
  const ownerUserId = row.ownerUserId ?? null;
  getProjectsDb()
    .prepare(
      `INSERT INTO workflow_templates (id, title, description, owner_user_id, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    )
    .run(row.id, row.title, row.description, ownerUserId);
}

export function insertWorkflowTemplateStageRow(row: {
  templateId: string;
  id: string;
  title: string;
  description: string;
  purpose: string;
  rulesJson: string;
  position: number;
  autoAssign: boolean;
  layoutX: number | null;
  layoutY: number | null;
  spawnTaskCount: number;
  taskTemplatesJson: string;
}) {
  migrateWorkflowTemplateTables();
  let autoAssignFlag = 0;
  if (row.autoAssign) {
    autoAssignFlag = 1;
  }
  getProjectsDb()
    .prepare(
      `INSERT INTO workflow_template_stages
        (template_id, id, title, description, purpose, rules_json, position, auto_assign, layout_x, layout_y, spawn_task_count, task_templates_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(
      row.templateId,
      row.id,
      row.title,
      row.description,
      row.purpose,
      row.rulesJson,
      row.position,
      autoAssignFlag,
      row.layoutX,
      row.layoutY,
      row.spawnTaskCount,
      row.taskTemplatesJson,
    );
}

export { DEFAULT_WORKFLOW_TEMPLATE_ID } from "../domain/workflow-template-id.js";

export function seedDefaultWorkflowTemplates() {
  migrateWorkflowTemplateTables();
  removeDeprecatedTemplates();
  for (const template of DEFAULT_TEMPLATE_SEEDS) {
    upsertBuiltinTemplate(template);
  }
}
