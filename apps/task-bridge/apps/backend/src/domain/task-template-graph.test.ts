import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectSpawnableTemplates, type TemplateSpawnContext } from "./task-template-graph.js";
import type { StageTaskTemplate } from "./workflow-stage.js";

function ctx(overrides: Partial<TemplateSpawnContext> = {}): TemplateSpawnContext {
  return {
    stageId: "stage-1",
    stagePosition: 0,
    activeStagePosition: 0,
    spawnedTemplateIds: new Set<string>(),
    doneTemplateIds: new Set<string>(),
    ...overrides,
  };
}

function task(id: string, title: string, children: StageTaskTemplate[] = []): StageTaskTemplate {
  return {
    id,
    title,
    description: "",
    assigneeRole: null,
    dependsOn: [],
    children,
  };
}

describe("task template graph", () => {
  it("spawns parallel roots on active stage", () => {
    const roots = [task("a", "A"), task("b", "B")];
    const spawnable = collectSpawnableTemplates(roots, ctx());
    assert.deepEqual(
      spawnable.map((item) => item.id),
      ["a", "b"],
    );
  });

  it("spawns next sibling after dependsOn is done", () => {
    const second = task("b", "B");
    second.dependsOn = ["a"];
    const roots = [task("a", "A"), second];
    const spawnable = collectSpawnableTemplates(
      roots,
      ctx({
        spawnedTemplateIds: new Set(["a"]),
        doneTemplateIds: new Set(["a"]),
      }),
    );
    assert.deepEqual(
      spawnable.map((item) => item.id),
      ["b"],
    );
  });

  it("waits for dependsOn before spawning", () => {
    const blocked = task("blocked", "Blocked");
    blocked.dependsOn = ["dep"];
    const roots = [task("dep", "Dep"), blocked];
    const spawnable = collectSpawnableTemplates(roots, ctx());
    assert.deepEqual(
      spawnable.map((item) => item.id),
      ["dep"],
    );
  });

  it("does not spawn children until parent task is done", () => {
    const child = task("child", "Child");
    const parent = task("parent", "Parent", [child]);
    const spawnable = collectSpawnableTemplates(
      [parent],
      ctx({ spawnedTemplateIds: new Set(["parent"]) }),
    );
    assert.deepEqual(spawnable, []);
  });

  it("spawns parallel children when parent task is done", () => {
    const childA = task("child-a", "Child A");
    const childB = task("child-b", "Child B");
    const parent = task("parent", "Parent", [childA, childB]);
    const spawnable = collectSpawnableTemplates(
      [parent],
      ctx({
        spawnedTemplateIds: new Set(["parent"]),
        doneTemplateIds: new Set(["parent"]),
      }),
    );
    assert.deepEqual(
      spawnable.map((item) => item.id),
      ["child-a", "child-b"],
    );
  });
});
