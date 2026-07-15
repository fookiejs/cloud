import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { consumerStatus } from "./task-response.js";
import type { BridgeTask } from "../domain/task.js";
function makeTask(overrides: Partial<BridgeTask>): BridgeTask {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: 1,
    title: "Task",
    projectId: "demo",
    projectName: "Demo",
    parentId: null,
    epicId: null,
    templateId: null,
    description: "",
    priority: null,
    labels: [],
    assignee: null,
    createdBy: "test",
    createdAt: now,
    updatedAt: now,
    claimedBy: null,
    claimedAt: null,
    answeredBy: null,
    answeredAt: null,
    answer: null,
    stageId: "development",
    brief: "",
    agentMetadata: {},
    comments: [],
    events: [],
    ...overrides,
  };
}

describe("task response mapper", () => {
  it("returns sent while task is claimed", () => {
    const status = consumerStatus(makeTask({ claimedBy: "worker", claimedAt: nowIso() }));
    assert.equal(status, "sent");
  });

  it("returns ready when task is done", () => {
    const status = consumerStatus(makeTask({ workStatus: "done" }));
    assert.equal(status, "ready");
  });

  it("returns sent when user commented after system", () => {
    const status = consumerStatus(
      makeTask({
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
      }),
    );
    assert.equal(status, "sent");
  });
});

function nowIso() {
  return new Date().toISOString();
}
