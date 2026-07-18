import type { StageTaskTemplate, WorkflowStage } from "@/lib/api";
import {
  countSpawnableTemplates,
  NODE_ADD_BTN_SIZE,
  sanitizeStageTemplates,
  templateStackHeight,
} from "./template-graph-utils";

export const TASK_REORDER_WIDTH = 24;
export const SUBTASK_CONNECTOR_WIDTH = 28;
export const TASK_ROW_LINK_WIDTH = 20;
export const TASK_NODE_GAP = 8;
export const STAGE_TASK_ADD_STACK = 16 + NODE_ADD_BTN_SIZE;

export function taskRowCanvasWidth(depth: number): number {
  let connectorWidth = 0;
  if (depth > 0) {
    connectorWidth = SUBTASK_CONNECTOR_WIDTH;
  }
  return (
    depth * TASK_DEPTH_INDENT +
    connectorWidth +
    TASK_REORDER_WIDTH +
    TASK_NODE_WIDTH +
    TASK_ROW_LINK_WIDTH +
    NODE_ADD_BTN_SIZE
  );
}

export function maxTaskTreeCanvasWidth(nodes: StageTaskTemplate[]): number {
  let max = 0;
  function walk(node: StageTaskTemplate, depth: number) {
    max = Math.max(max, taskRowCanvasWidth(depth));
    for (const child of sanitizeStageTemplates(node.children)) {
      walk(child, depth + 1);
    }
  }
  for (const root of sanitizeStageTemplates(nodes)) {
    walk(root, 0);
  }
  return max;
}

function resolveStageColumnWidth(stage: WorkflowStage, stageCardWidth: number): number {
  const templates = stage.taskTemplates;
  if (templates.length === 0) return stageCardWidth;
  return Math.max(stageCardWidth, maxTaskTreeCanvasWidth(templates));
}

export function stageLayoutKey(stages: WorkflowStage[]): string {
  return stages
    .map((stage) => {
      const templates = stage.taskTemplates;
      return [
        stage.id,
        countSpawnableTemplates(templates),
        maxTaskTreeCanvasWidth(templates),
        templateStackHeight(templates),
      ].join(":");
    })
    .join("|");
}

export const STAGE_CARD_WIDTH = 280;
export const STAGE_CARD_HEIGHT = 88;
export const STAGE_COLUMN_GAP = 56;
export const STEP_TASK_GAP = 20;
export const TASK_TEMPLATE_HEIGHT = 40;
export const TASK_TEMPLATE_GAP = 8;
export const TASK_NODE_WIDTH = 248;
export const TASK_DEPTH_INDENT = 22;
export const CANVAS_WIDTH = 4800;
export const CANVAS_HEIGHT = 3200;

export type DisplayStage = WorkflowStage & {
  displayX: number;
  displayY: number;
  columnWidth: number;
};

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function stagesForDisplay(stages: WorkflowStage[]): DisplayStage[] {
  const sorted = stages.slice().sort((a, b) => a.position - b.position);
  const widths = sorted.map((stage) => resolveStageColumnWidth(stage, STAGE_CARD_WIDTH));
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, sorted.length - 1) * STAGE_COLUMN_GAP;
  let cursorX = Math.max(80, (CANVAS_WIDTH - totalWidth) / 2);
  const maxStack = sorted.reduce(
    (max, stage) => Math.max(max, stageStackHeight(stage)),
    STAGE_CARD_HEIGHT,
  );
  const centerY = Math.max(48, (CANVAS_HEIGHT - maxStack) / 2);
  return sorted.map((stage, index) => {
    let columnWidth = STAGE_CARD_WIDTH;
    if (index >= 0 && index < widths.length) {
      const widthAtIndex = widths[index];
      if (typeof widthAtIndex === "number") {
        columnWidth = widthAtIndex;
      }
    }
    const displayX = cursorX;
    cursorX += columnWidth + STAGE_COLUMN_GAP;
    return Object.assign({}, stage, {
      displayX,
      displayY: centerY,
      columnWidth,
    });
  });
}

function newEntityId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createEmptyStage(position: number): WorkflowStage {
  return {
    id: newEntityId("stage"),
    title: "New step",
    description: "",
    position,
    autoAssignRole: null,
    layoutX: null,
    layoutY: null,
    spawnTaskCount: 0,
    taskTemplates: [],
    activeTaskCount: null,
  };
}

export function insertStageAt(
  stages: WorkflowStage[],
  afterIndex: number | null,
  stage: WorkflowStage,
): WorkflowStage[] {
  const sorted = stages.slice().sort((a, b) => a.position - b.position);
  let insertAt = 0;
  if (afterIndex !== null) {
    insertAt = afterIndex + 1;
  }
  const next = sorted.slice(0, insertAt).concat([stage], sorted.slice(insertAt));
  return next.map((item, position) => Object.assign({}, item, { position }));
}

export function moveStageBy(stages: WorkflowStage[], index: number, delta: -1 | 1): WorkflowStage[] {
  const sorted = stages.slice().sort((a, b) => a.position - b.position);
  const target = index + delta;
  if (target < 0 || target >= sorted.length) return stages;
  const next = sorted.slice();
  const current = next[index];
  const swap = next[target];
  if (!current || !swap) return stages;
  next[index] = swap;
  next[target] = current;
  return next.map((item, position) => Object.assign({}, item, { position }));
}

export function syncStageTemplates(stage: WorkflowStage): WorkflowStage {
  const taskTemplates = sanitizeStageTemplates(stage.taskTemplates);
  return Object.assign({}, stage, {
    taskTemplates,
    spawnTaskCount: countSpawnableTemplates(taskTemplates),
  });
}

export function stageStackHeight(stage: WorkflowStage): number {
  const templates = stage.taskTemplates;
  const base = STAGE_CARD_HEIGHT + STAGE_TASK_ADD_STACK;
  if (templates.length === 0) return base;
  return base + STEP_TASK_GAP + templateStackHeight(templates);
}

export function normalizeStagePositions(stages: WorkflowStage[]): WorkflowStage[] {
  return stages
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((stage, position) => Object.assign({}, stage, { position }));
}

export function screenToCanvas(
  screenX: number,
  screenY: number,
  rect: DOMRect,
  pan: { x: number; y: number },
  zoom: number,
) {
  return {
    x: (screenX - rect.left - pan.x) / zoom,
    y: (screenY - rect.top - pan.y) / zoom,
  };
}

type CanvasPanZoomRefs = {
  getZoom: () => number;
  getPan: () => { x: number; y: number };
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
};

export function bindCanvasWheelZoom(
  element: HTMLElement,
  refs: CanvasPanZoomRefs,
  minZoom: number,
  maxZoom: number,
) {
  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const currentZoom = refs.getZoom();
    const currentPan = refs.getPan();
    let factor = 0.92;
    if (event.deltaY < 0) {
      factor = 1.08;
    }
    const nextZoom = Math.min(maxZoom, Math.max(minZoom, currentZoom * factor));
    const scale = nextZoom / currentZoom;
    refs.setPan({
      x: pointerX - (pointerX - currentPan.x) * scale,
      y: pointerY - (pointerY - currentPan.y) * scale,
    });
    refs.setZoom(nextZoom);
  }
  element.addEventListener("wheel", onWheel, { passive: false });
  return () => element.removeEventListener("wheel", onWheel);
}

export type PanDragState = {
  startX: number;
  startY: number;
  panX: number;
  panY: number;
};

export function beginPanPointer(event: {
  preventDefault: () => void;
  pointerId: number;
  currentTarget: EventTarget | null;
}) {
  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
}

export function bindPanDrag(
  onMove: (event: PointerEvent) => void,
  onEnd: () => void,
): () => void {
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";

  function handleMove(event: PointerEvent) {
    event.preventDefault();
    onMove(event);
  }

  function handleUp() {
    onEnd();
  }

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleUp);
  return () => {
    document.body.style.userSelect = previousUserSelect;
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
    window.removeEventListener("pointercancel", handleUp);
  };
}
