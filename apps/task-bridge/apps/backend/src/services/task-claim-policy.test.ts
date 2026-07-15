import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BridgeTask } from "../domain/task.js";
import type { EpicClaimIndex } from "./task-claim-policy.js";
import {
  canActorClaimTask,
  canActorUpdateWorkStatus,
  isWorkflowClaimable,
  rolesMatch,
  sortWorkflowClaimCandidates,
  userAwaitingReply,
} from "./task-claim-policy.js";

function makeIndex(activeStageId: string): EpicClaimIndex {
  return {
    activeStageByEpic: new Map([[1, activeStageId]]),
    stagePositionByProject: new Map([
      [
        "p1",
        new Map([
          ["stage-1", 0],
          ["stage-2", 1],
        ]),
      ],
    ]),
  };
}

function makeTask(overrides: Partial<BridgeTask> & { id: number }): BridgeTask {
  const now = new Date().toISOString();
  const { id, ...rest } = overrides;
  return {
    id,
    projectId: "p1",
    projectName: "Project",
    parentId: null,
    epicId: null,
    templateId: null,
    title: `Task ${id}`,
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
    stageId: "stage-1",
    workStatus: "todo",
    brief: "",
    agentMetadata: {},
    comments: [],
    events: [],
    ...rest,
    epicId: rest.epicId ?? (rest.parentId ? 1 : null),
  };
}

describe("task claim policy", () => {
  it("only allows tasks on the epic active stage", () => {
    const tasks = [
      makeTask({ id: 1, parentId: null, stageId: "stage-1" }),
      makeTask({ id: 10, parentId: 1, stageId: "stage-1", workStatus: "todo" }),
      makeTask({ id: 11, parentId: 1, stageId: "stage-2", workStatus: "todo" }),
    ];
    const index = makeIndex("stage-1");
    assert.equal(isWorkflowClaimable(tasks[1]!, index, null), true);
    assert.equal(isWorkflowClaimable(tasks[2]!, index, null), false);
  });

  it("prefers in-progress work on the active stage", () => {
    const tasks = [
      makeTask({ id: 1, parentId: null, stageId: "stage-1" }),
      makeTask({
        id: 10,
        parentId: 1,
        stageId: "stage-1",
        workStatus: "todo",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      makeTask({
        id: 11,
        parentId: 1,
        stageId: "stage-1",
        workStatus: "in_progress",
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
    ];
    const index = makeIndex("stage-1");
    const sorted = sortWorkflowClaimCandidates(tasks.filter((task) => task.parentId !== null), index);
    assert.equal(sorted[0]?.id, 11);
  });

  it("matches roles case-insensitively", () => {
    assert.equal(rolesMatch("Developer", "developer"), true);
    assert.equal(rolesMatch("product", "developer"), false);
    assert.equal(rolesMatch("developer", null), true);
  });

  it("lets any member claim when a human is waiting for a reply", () => {
    const task = makeTask({
      id: 10,
      parentId: 1,
      assigneeRole: "developer",
      comments: [
        {
          id: "system-1",
          role: "system",
          authorId: "system",
          tags: [],
          body: "update",
          at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "human-1",
          role: "user",
          authorId: "user",
          tags: [],
          body: "follow up",
          at: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    const index = makeIndex("stage-1");
    assert.equal(userAwaitingReply(task), true);
    assert.equal(
      canActorClaimTask(task, index, { claimedBy: "Dev", role: "developer" }),
      true,
    );
    assert.equal(
      canActorClaimTask(task, index, { claimedBy: "PM", role: "product" }),
      true,
    );
  });

  it("blocks claim when actor role does not match assignment", () => {
    const task = makeTask({
      id: 10,
      parentId: 1,
      assigneeRole: "developer",
    });
    const index = makeIndex("stage-1");
    assert.equal(
      canActorClaimTask(task, index, { claimedBy: "Dev", role: "developer" }),
      true,
    );
    assert.equal(
      canActorClaimTask(task, index, { claimedBy: "PM", role: "product" }),
      false,
    );
  });
});
