import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkflowStageRow } from "../db/workflow-db.js";
import type { BridgeTask } from "../domain/task.js";
import { listDescendantIds } from "../domain/task.js";
import { collectLaterStageTodoCascadeIds, computeEpicStageId } from "./epic-service.js";

function makeStage(overrides: Partial<WorkflowStageRow> & { id: string; position: number }): WorkflowStageRow {
  return {
    project_id: "demo",
    title: overrides.id,
    description: "",
    purpose: "",
    rules_json: "[]",
    auto_assign: 0,
    auto_assign_role: "",
    layout_x: null,
    layout_y: null,
    spawn_task_count: 0,
    task_templates_json: "[]",
    roles_json: "{}",
    ...overrides,
  };
}

function makeSubtask(overrides: Partial<BridgeTask> & { id: number }): BridgeTask {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: overrides.id,
    title: "Task",
    projectId: "demo",
    projectName: "Demo",
    parentId: 1,
    epicId: 1,
    templateId: null,
    description: "",
    acceptanceCriteria: null,
    priority: null,
    labels: [],
    assignee: "",
    assigneeRole: null,
    assigneeKind: null,
    createdBy: "test",
    createdAt: now,
    updatedAt: now,
    claimedBy: null,
    claimedAt: null,
    answeredBy: null,
    answeredAt: null,
    answer: null,
    stageId: overrides.stageId ?? null,
    brief: "",
    agentMetadata: {},
    comments: [],
    events: [],
    workStatus: overrides.workStatus ?? "todo",
    ...overrides,
  };
}

describe("collectLaterStageTodoCascadeIds", () => {
  it("resets later-stage epic tasks when a task is cancelled to todo", () => {
    const rows = [
      makeStage({ id: "plan", position: 0, task_templates_json: "[]" }),
      makeStage({ id: "build", position: 1, task_templates_json: "[]" }),
      makeStage({ id: "ship", position: 2, task_templates_json: "[]" }),
    ];
    const cancelled = makeSubtask({ id: 10, stageId: "plan", workStatus: "done" });
    const sameStage = makeSubtask({ id: 11, stageId: "plan", workStatus: "done" });
    const laterStage = makeSubtask({ id: 12, stageId: "build", workStatus: "done" });
    const lastStage = makeSubtask({ id: 13, stageId: "ship", workStatus: "in_progress" });
    const child = makeSubtask({ id: 14, parentId: 12, stageId: "build", workStatus: "done" });

    const ids = collectLaterStageTodoCascadeIds(
      [cancelled, sameStage, laterStage, lastStage, child],
      cancelled,
      rows,
    );

    assert.deepEqual(new Set(ids), new Set([12, 13, 14]));
  });

  it("still resets nested descendants of the cancelled task", () => {
    const rows = [makeStage({ id: "plan", position: 0, task_templates_json: "[]" })];
    const parent = makeSubtask({ id: 10, stageId: "plan", workStatus: "in_progress" });
    const child = makeSubtask({ id: 11, parentId: 10, stageId: "plan", workStatus: "done" });

    assert.deepEqual(listDescendantIds([parent, child], parent.id), [11]);
    assert.deepEqual(collectLaterStageTodoCascadeIds([parent, child], parent, rows), []);
  });

  it("uses parent stage when a deep nested subtask has no stage id", () => {
    const rows = [
      makeStage({ id: "plan", position: 0, task_templates_json: "[]" }),
      makeStage({ id: "build", position: 1, task_templates_json: "[]" }),
      makeStage({ id: "ship", position: 2, task_templates_json: "[]" }),
    ];
    const root = makeSubtask({ id: 10, stageId: "plan", workStatus: "done" });
    const nested = makeSubtask({ id: 11, parentId: 10, workStatus: "done" });
    const deep = makeSubtask({ id: 12, parentId: 11, workStatus: "in_progress" });
    const later = makeSubtask({ id: 20, stageId: "build", workStatus: "done" });

    const ids = collectLaterStageTodoCascadeIds([root, nested, deep, later], deep, rows);

    assert.deepEqual(ids, [20]);
  });
});

describe("computeEpicStageId", () => {
  it("skips empty stages and lands on the first stage with templates", () => {
    const rows = [
      makeStage({ id: "todo", position: 0, task_templates_json: "[]" }),
      makeStage({
        id: "in-progress",
        position: 1,
        task_templates_json: JSON.stringify([{ id: "t1", title: "Develop", description: "" }]),
      }),
      makeStage({ id: "done", position: 2, task_templates_json: "[]" }),
    ];
    const stageId = computeEpicStageId(rows, []);
    assert.equal(stageId, "in-progress");
  });

  it("stays on a stage while work is incomplete", () => {
    const rows = [
      makeStage({ id: "todo", position: 0, task_templates_json: "[]" }),
      makeStage({
        id: "in-progress",
        position: 1,
        task_templates_json: JSON.stringify([{ id: "t1", title: "Develop", description: "" }]),
      }),
    ];
    const stageId = computeEpicStageId(rows, [
      makeSubtask({ id: 10, stageId: "in-progress", workStatus: "in_progress" }),
    ]);
    assert.equal(stageId, "in-progress");
  });

  it("advances past completed stages with templates", () => {
    const rows = [
      makeStage({
        id: "todo",
        position: 0,
        task_templates_json: JSON.stringify([{ id: "t0", title: "Plan", description: "" }]),
      }),
      makeStage({
        id: "in-progress",
        position: 1,
        task_templates_json: JSON.stringify([{ id: "t1", title: "Develop", description: "" }]),
      }),
    ];
    const stageId = computeEpicStageId(rows, [
      makeSubtask({ id: 10, stageId: "todo", workStatus: "done" }),
    ]);
    assert.equal(stageId, "in-progress");
  });
});
