import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanAdvanceWorkStatus,
  assertCanCompleteTask,
  DONE_STAGE_ID,
  incompleteSubtasks,
  isDoneStage,
  listDescendantIds,
  listEpicWorkflowTasks,
  listSubtasks,
  resolveTaskStageId,
  type BridgeTask,
} from "./task.js";
import { AppError } from "../errors/app-error.js";

function makeTask(overrides: Partial<BridgeTask> & Pick<BridgeTask, "id" | "title">): BridgeTask {
  const now = "2026-01-01T00:00:00.000Z";
  const { id, title, ...rest } = overrides;
  return {
    id,
    title,
    projectId: overrides.projectId ?? "demo",
    projectName: overrides.projectName ?? "Demo",
    parentId: overrides.parentId ?? null,
    epicId: overrides.epicId ?? null,
    templateId: overrides.templateId ?? null,
    description: overrides.description ?? "",
    acceptanceCriteria: null,
    priority: overrides.priority ?? null,
    labels: [],
    assignee: overrides.assignee ?? "",
    assigneeRole: overrides.assigneeRole ?? null,
    assigneeKind: null,
    createdBy: "test",
    createdAt: now,
    updatedAt: now,
    claimedBy: null,
    claimedAt: null,
    answeredBy: null,
    answeredAt: null,
    answer: null,
    stageId: overrides.stageId ?? "backlog",
    workStatus: overrides.workStatus ?? null,
    brief: "",
    agentMetadata: {},
    comments: [],
    events: [],
    ...rest,
  };
}

describe("task domain", () => {
  it("blocks parent completion when subtasks are open", () => {
    const parent = makeTask({ id: 1, title: "Parent", stageId: "review" });
    const child = makeTask({ id: 2, title: "Child", parentId: 1, stageId: "development" });
    const tasks = [parent, child];

    assert.equal(incompleteSubtasks(tasks, 1).length, 1);
    assert.throws(
      () => assertCanCompleteTask(tasks, parent),
      (error: Object | null) => error instanceof AppError && error.statusCode === 409,
    );
  });

  it("allows parent completion when all subtasks are done", () => {
    const parent = makeTask({ id: 1, title: "Parent", stageId: "review" });
    const child = makeTask({ id: 2, title: "Child", parentId: 1, stageId: DONE_STAGE_ID });
    assert.doesNotThrow(() => assertCanCompleteTask([parent, child], parent));
  });

  it("blocks child in_progress when parent is not done", () => {
    const epic = makeTask({ id: 1, title: "Epic" });
    const parent = makeTask({ id: 2, title: "Parent", parentId: 1, workStatus: "todo" });
    const child = makeTask({ id: 3, title: "Child", parentId: 2, workStatus: "todo" });
    const tasks = [epic, parent, child];
    assert.throws(
      () => assertCanAdvanceWorkStatus(tasks, child, "in_progress"),
      (error: Object | null) => error instanceof AppError && error.statusCode === 409,
    );
  });

  it("allows child in_progress when parent is done", () => {
    const epic = makeTask({ id: 1, title: "Epic" });
    const parent = makeTask({
      id: 2,
      title: "Parent",
      parentId: 1,
      workStatus: "done",
      stageId: DONE_STAGE_ID,
    });
    const child = makeTask({ id: 3, title: "Child", parentId: 2, workStatus: "todo" });
    assert.doesNotThrow(() => assertCanAdvanceWorkStatus([epic, parent, child], child, "in_progress"));
  });

  it("allows epic child to advance without parent work status", () => {
    const epic = makeTask({ id: 1, title: "Epic" });
    const child = makeTask({ id: 2, title: "Child", parentId: 1, workStatus: "todo" });
    assert.doesNotThrow(() => assertCanAdvanceWorkStatus([epic, child], child, "in_progress"));
  });

  it("lists subtasks for parent", () => {
    const parent = makeTask({ id: 1, title: "Parent" });
    const child = makeTask({ id: 2, title: "Child", parentId: 1 });
    const other = makeTask({ id: 3, title: "Other" });
    const subtasks = listSubtasks([parent, child, other], 1);
    assert.equal(subtasks.length, 1);
    assert.equal(subtasks[0]?.id, 2);
  });

  it("lists descendant ids at any depth", () => {
    const root = makeTask({ id: 1, title: "Root" });
    const child = makeTask({ id: 2, title: "Child", parentId: 1 });
    const grandchild = makeTask({ id: 3, title: "Grandchild", parentId: 2 });
    const great = makeTask({ id: 4, title: "Great", parentId: 3 });
    const ids = listDescendantIds([root, child, grandchild, great], 1);
    assert.deepEqual(ids, [2, 3, 4]);
  });

  it("detects done stage", () => {
    assert.equal(isDoneStage(DONE_STAGE_ID), true);
    assert.equal(isDoneStage("development"), false);
  });

  it("inherits stage id from parent chain for nested subtasks", () => {
    const root = makeTask({ id: 1, title: "Root", epicId: 1, stageId: "plan" });
    const child = makeTask({ id: 2, title: "Child", parentId: 1, epicId: 1, stageId: null });
    const tasks = [root, child];
    assert.equal(resolveTaskStageId(tasks, child), "plan");
  });

  it("lists epic workflow tasks when epic id is only on the ancestor", () => {
    const epic = makeTask({ id: 1, title: "Epic", epicId: null });
    const child = makeTask({ id: 2, title: "Child", parentId: 1, epicId: null, stageId: "plan" });
    const listed = listEpicWorkflowTasks([epic, child], 1);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, 2);
  });
});
