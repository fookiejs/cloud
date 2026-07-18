import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Layers,
  Maximize2,
  Plus,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StageTaskTemplate, WorkflowStage } from "@/lib/api";
import {
  canMoveTemplateAmongSiblings,
  sanitizeStageTemplates,
} from "./template-graph-utils";
import { NodeAddButton } from "./NodeAddButton";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  STAGE_CARD_HEIGHT,
  STAGE_CARD_WIDTH,
  STEP_TASK_GAP,
  TASK_DEPTH_INDENT,
  TASK_NODE_WIDTH,
  TASK_TEMPLATE_HEIGHT,
  type DisplayStage,
  beginPanPointer,
  bindCanvasWheelZoom,
  bindPanDrag,
  type PanDragState,
  stageLayoutKey,
  stageStackHeight,
  stagesForDisplay,
} from "./workflow-utils";

type WorkflowCanvasProps = {
  stages: WorkflowStage[];
  selectedStageId: string | null;
  selectedTaskTemplateId: string | null;
  onAddStage: () => void;
  onInsertStageAfter: (afterIndex: number) => void;
  onMoveStage: (index: number, delta: -1 | 1) => void;
  onSelectStage: (flowIndex: number) => void | null;
  onSelectTaskTemplate: (flowIndex: number, templateId: string) => void | null;
  onAddStageTask: (flowIndex: number) => void | null;
  onAddSubtask: (flowIndex: number, parentTemplateId: string) => void | null;
  onMoveTaskTemplate: (flowIndex: number, templateId: string, delta: -1 | 1) => void | null;
  className: string | null;
};

type Point = { x: number; y: number };

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.6;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stageConnectorPoints(from: DisplayStage, to: DisplayStage) {
  const start = {
    x: from.displayX + STAGE_CARD_WIDTH,
    y: from.displayY + STAGE_CARD_HEIGHT / 2,
  };
  const end = {
    x: to.displayX,
    y: to.displayY + STAGE_CARD_HEIGHT / 2,
  };
  return { start, end };
}

function connectorPath(from: DisplayStage, to: DisplayStage) {
  const { start, end } = stageConnectorPoints(from, to);
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

function connectorMidpoint(from: DisplayStage, to: DisplayStage) {
  const { start, end } = stageConnectorPoints(from, to);
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

function StageCard({
  stage,
  flowIndex,
  selected,
  canMoveLeft,
  canMoveRight,
  onSelect,
  onMoveLeft,
  onMoveRight,
}: {
  stage: DisplayStage;
  flowIndex: number;
  selected: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onSelect: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}) {
  const templateCount = sanitizeStageTemplates(stage.taskTemplates).length;
  return (
    <div
      data-stage-card="true"
      className={cn(
        "pointer-events-auto relative flex w-full shrink-0 select-none flex-col overflow-hidden rounded-2xl border bg-[#161616] shadow-lg transition-[border-color,box-shadow] duration-150",
        selected ? "border-white/25 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]" : "border-white/[0.08]",
      )}
      style={{ height: STAGE_CARD_HEIGHT }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <button
          type="button"
          disabled={!canMoveLeft}
          onClick={(event) => {
            event.stopPropagation();
            onMoveLeft();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
          aria-label="Move left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-0 flex-1 truncate px-1 text-center text-[11px] font-medium text-muted-foreground">
          {flowIndex + 1}
        </span>
        <button
          type="button"
          disabled={!canMoveRight}
          onClick={(event) => {
            event.stopPropagation();
            onMoveRight();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
          aria-label="Move right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        data-stage-select="true"
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        className="flex min-h-0 flex-1 items-center justify-between gap-2 px-4 py-2 text-left transition-colors hover:bg-white/[0.03]"
      >
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-snug text-white">
          {stage.title || "Untitled"}
        </p>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {templateCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-400">
              <Layers className="h-2.5 w-2.5" />
              {templateCount} tasks
            </span>
          ) : null}
        </div>
      </button>
    </div>
  );
}

function NodeLink(rawProps: Partial<{ className: string | null }> = {}) {
  let className: string | null = null;
  if ("className" in rawProps) {
    if (rawProps.className === null) {
      className = null;
    } else if (typeof rawProps.className === "string") {
      className = rawProps.className;
    }
  }
  return <div className={cn("shrink-0 bg-white/[0.14]", className)} />;
}

function TaskReorderButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "up" | "down";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      data-task-reorder="true"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex h-[18px] w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
      aria-label={direction === "up" ? "Move up" : "Move down"}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function TaskNode({
  template,
  depth,
  stageTemplates,
  selectedTaskTemplateId,
  onSelectTaskTemplate,
  onAddSubtask,
  onMoveTaskTemplate,
}: {
  template: StageTaskTemplate;
  depth: number;
  stageTemplates: StageTaskTemplate[];
  selectedTaskTemplateId: string | null;
  onSelectTaskTemplate: (templateId: string) => void;
  onAddSubtask: (parentTemplateId: string) => void;
  onMoveTaskTemplate: (templateId: string, delta: -1 | 1) => void;
}) {
  const selected = selectedTaskTemplateId === template.id;
  const isSubtask = depth > 0;
  const children = sanitizeStageTemplates(template.children);
  const indent = depth * TASK_DEPTH_INDENT;
  const canMoveUp = canMoveTemplateAmongSiblings(stageTemplates, template.id, -1);
  const canMoveDown = canMoveTemplateAmongSiblings(stageTemplates, template.id, 1);
  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      <div className="flex items-center" style={{ paddingLeft: indent }}>
        {depth > 0 ? (
          <div className="relative mr-1 h-10 w-6 shrink-0">
            <NodeLink className="absolute right-0 top-1/2 h-px w-4 -translate-y-1/2" />
            <NodeLink className="absolute right-3 top-0 h-1/2 w-px" />
          </div>
        ) : null}
        <div className="flex items-center">
          <div className="mr-1 flex shrink-0 flex-col">
            <TaskReorderButton
              direction="up"
              disabled={!canMoveUp}
              onClick={() => onMoveTaskTemplate(template.id, -1)}
            />
            <TaskReorderButton
              direction="down"
              disabled={!canMoveDown}
              onClick={() => onMoveTaskTemplate(template.id, 1)}
            />
          </div>
          <button
            type="button"
            data-task-template="true"
            onClick={(event) => {
              event.stopPropagation();
              onSelectTaskTemplate(template.id);
            }}
            className={cn(
              "relative flex shrink-0 items-center rounded-lg border px-3 text-left transition-[border-color,background-color] duration-150 hover:bg-[#151515]",
              selected ? "border-emerald-500/30 bg-[#141a16]" : "border-white/[0.07] bg-[#111111]",
            )}
            style={{ width: TASK_NODE_WIDTH, minHeight: TASK_TEMPLATE_HEIGHT }}
          >
            <div className="flex w-full items-center gap-2">
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  isSubtask ? "bg-sky-500/80" : "bg-emerald-500/80",
                )}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/90">
                {template.title}
              </span>
            </div>
          </button>
          <NodeLink className="mx-1 h-px w-3" />
          <NodeAddButton title="Add subtask" dataNodeInsert="true" onClick={() => onAddSubtask(template.id)} className={null} disabled={null} style={null} dataEpicAdd={null} dataStageInsert={null} />
        </div>
      </div>
      {children.length > 0 ? (
        <div className="flex flex-col gap-2">
          {children.map((child) => (
            <TaskNode
              key={child.id}
              template={child}
              depth={depth + 1}
              stageTemplates={stageTemplates}
              selectedTaskTemplateId={selectedTaskTemplateId}
              onSelectTaskTemplate={onSelectTaskTemplate}
              onAddSubtask={onAddSubtask}
              onMoveTaskTemplate={onMoveTaskTemplate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StageColumn({
  stage,
  flowIndex,
  templates,
  selectedStageId,
  selectedTaskTemplateId,
  canMoveLeft,
  canMoveRight,
  onSelectStage,
  onSelectTaskTemplate,
  onAddStageTask,
  onAddSubtask,
  onMoveTaskTemplate,
  onMoveLeft,
  onMoveRight,
}: {
  stage: DisplayStage;
  flowIndex: number;
  templates: StageTaskTemplate[];
  selectedStageId: string | null;
  selectedTaskTemplateId: string | null;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onSelectStage: () => void;
  onSelectTaskTemplate: (templateId: string) => void;
  onAddStageTask: () => void;
  onAddSubtask: (parentTemplateId: string) => void;
  onMoveTaskTemplate: (templateId: string, delta: -1 | 1) => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}) {
  const roots = sanitizeStageTemplates(templates);
  const columnWidth = (stage.columnWidth !== null ? stage.columnWidth : STAGE_CARD_WIDTH);
  return (
    <div
      className="pointer-events-none absolute flex flex-col items-start"
      style={{ left: stage.displayX, top: stage.displayY, width: columnWidth }}
    >
      <div className="relative z-10 shrink-0" style={{ width: STAGE_CARD_WIDTH }}>
        <StageCard
          stage={stage}
          flowIndex={flowIndex}
          selected={selectedStageId === stage.id && !selectedTaskTemplateId}
          canMoveLeft={canMoveLeft}
          canMoveRight={canMoveRight}
          onSelect={onSelectStage}
          onMoveLeft={onMoveLeft}
          onMoveRight={onMoveRight}
        />
        <div className="flex flex-col items-center">
          <NodeLink className="h-4 w-px" />
          <NodeAddButton title="Add task to step" dataNodeInsert="true" onClick={onAddStageTask} className={null} disabled={null} style={null} dataEpicAdd={null} dataStageInsert={null} />
        </div>
      </div>
      <div
        className="pointer-events-auto relative z-0 flex w-full flex-col gap-2"
        style={{ marginTop: STEP_TASK_GAP }}
      >
        {roots.map((template) => (
          <TaskNode
            key={template.id}
            template={template}
            depth={0}
            stageTemplates={templates}
            selectedTaskTemplateId={
              selectedStageId === stage.id ? selectedTaskTemplateId : null
            }
            onSelectTaskTemplate={onSelectTaskTemplate}
            onAddSubtask={onAddSubtask}
            onMoveTaskTemplate={onMoveTaskTemplate}
          />
        ))}
      </div>
    </div>
  );
}

export function WorkflowCanvas({
  stages,
  selectedStageId = null,
  selectedTaskTemplateId = null,
  onAddStage,
  onInsertStageAfter,
  onMoveStage,
  onSelectStage,
  onSelectTaskTemplate,
  onAddStageTask,
  onAddSubtask,
  onMoveTaskTemplate,
  className,
}: WorkflowCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<Point>({ x: 48, y: 48 });
  const zoomRef = useRef(0.85);
  const [pan, setPan] = useState<Point>({ x: 48, y: 48 });
  const [zoom, setZoom] = useState(0.85);
  const [panDrag, setPanDrag] = useState<PanDragState | null>(null);

  panRef.current = pan;
  zoomRef.current = zoom;

  const displayStages = useMemo(() => stagesForDisplay(stages), [stages]);
  const layoutKey = useMemo(() => stageLayoutKey(stages), [stages]);

  const connectors = useMemo(() => {
    const paths: string[] = [];
    for (let index = 0; index < displayStages.length - 1; index += 1) {
      const from = displayStages[index];
      const to = displayStages[index + 1];
      if (from && to) paths.push(connectorPath(from, to));
    }
    return paths;
  }, [displayStages]);

  const fitView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || displayStages.length === 0) return;
    if (viewport.clientWidth === 0 || viewport.clientHeight === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const stage of displayStages) {
      minX = Math.min(minX, stage.displayX);
      minY = Math.min(minY, stage.displayY);
      maxX = Math.max(maxX, stage.displayX + stage.columnWidth);
      maxY = Math.max(maxY, stage.displayY + stageStackHeight(stage));
    }

    const padding = 80;
    const boundsW = maxX - minX + padding * 2;
    const boundsH = maxY - minY + padding * 2;
    const nextZoom = clamp(
      Math.min(viewport.clientWidth / boundsW, viewport.clientHeight / boundsH),
      MIN_ZOOM,
      1,
    );
    const contentW = boundsW * nextZoom;
    const contentH = boundsH * nextZoom;
    setZoom(nextZoom);
    setPan({
      x: (viewport.clientWidth - contentW) / 2 - (minX - padding) * nextZoom,
      y: (viewport.clientHeight - contentH) / 2 - (minY - padding) * nextZoom,
    });
  }, [displayStages]);

  const reflowPan = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || displayStages.length === 0) return;
    if (viewport.clientWidth === 0 || viewport.clientHeight === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const stage of displayStages) {
      minX = Math.min(minX, stage.displayX);
      minY = Math.min(minY, stage.displayY);
      maxX = Math.max(maxX, stage.displayX + stage.columnWidth);
      maxY = Math.max(maxY, stage.displayY + stageStackHeight(stage));
    }

    const boundsCenterX = (minX + maxX) / 2;
    const boundsCenterY = (minY + maxY) / 2;
    const currentZoom = zoomRef.current;
    setPan({
      x: viewport.clientWidth / 2 - boundsCenterX * currentZoom,
      y: viewport.clientHeight / 2 - boundsCenterY * currentZoom,
    });
  }, [displayStages]);

  const didInitialFitRef = useRef(false);
  const lastViewportSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || displayStages.length === 0) return;

    function applyViewportFit() {
      if (viewport === null) return;
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (width === 0 || height === 0) return;

      const wasHidden = lastViewportSizeRef.current.width === 0 || lastViewportSizeRef.current.height === 0;
      lastViewportSizeRef.current = { width, height };

      if (!didInitialFitRef.current || wasHidden) {
        didInitialFitRef.current = true;
        fitView();
        return;
      }
      reflowPan();
    }

    const observer = new ResizeObserver(() => applyViewportFit());
    observer.observe(viewport);
    applyViewportFit();
    return () => observer.disconnect();
  }, [layoutKey, displayStages.length, fitView, reflowPan]);

  useEffect(() => {
    if (!panDrag) return;
    const active = panDrag;
    return bindPanDrag(
      (event) => {
        setPan({
          x: active.panX + (event.clientX - active.startX),
          y: active.panY + (event.clientY - active.startY),
        });
      },
      () => {
        setPanDrag(null);
      },
    );
  }, [panDrag]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    return bindCanvasWheelZoom(
      el,
      {
        getZoom: () => zoomRef.current,
        getPan: () => panRef.current,
        setZoom,
        setPan,
      },
      MIN_ZOOM,
      MAX_ZOOM,
    );
  }, []);

  function isInteractiveTarget(target: HTMLElement) {
    return Boolean(
      target.closest(
        "[data-stage-card], [data-stage-insert], [data-node-insert], [data-task-template], [data-task-reorder]",
      ),
    );
  }

  function canStartPan(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button === 1) return true;
    if (event.button !== 0) return false;
    return !isInteractiveTarget(event.target as HTMLElement);
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    if (!canStartPan(event)) return;
    beginPanPointer(event);
    setPanDrag({
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    });
  }

  return (
    <div className={cn("relative flex min-h-0 flex-col bg-[#080808]", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2">
        <p className="text-xs text-muted-foreground">
          Drag to pan · Ctrl+scroll to zoom · Click nodes for details
        </p>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => clamp(z * 0.9, MIN_ZOOM, MAX_ZOOM))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => clamp(z * 1.1, MIN_ZOOM, MAX_ZOOM))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => fitView()}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onAddStage}>
            <Plus className="h-4 w-4" />
            Add stage
          </Button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 cursor-grab select-none overflow-hidden active:cursor-grabbing"
        onPointerDown={startPan}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
          }}
        >
          {displayStages.map((stage, flowIndex) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              flowIndex={flowIndex}
              templates={stage.taskTemplates}
              selectedStageId={selectedStageId}
              selectedTaskTemplateId={selectedTaskTemplateId}
              canMoveLeft={flowIndex > 0}
              canMoveRight={flowIndex < displayStages.length - 1}
              onSelectStage={() => {
                if (onSelectStage !== null) {
                  onSelectStage(flowIndex);
                }
              }}
              onSelectTaskTemplate={(templateId) => {
                if (onSelectTaskTemplate !== null) {
                  onSelectTaskTemplate(flowIndex, templateId);
                }
              }}
              onAddStageTask={() => {
                if (onAddStageTask !== null) {
                  onAddStageTask(flowIndex);
                }
              }}
              onAddSubtask={(parentId) => {
                if (onAddSubtask !== null) {
                  onAddSubtask(flowIndex, parentId);
                }
              }}
              onMoveTaskTemplate={(templateId, delta) => {
                if (onMoveTaskTemplate !== null) {
                  onMoveTaskTemplate(flowIndex, templateId, delta);
                }
              }}
              onMoveLeft={() => onMoveStage(flowIndex, -1)}
              onMoveRight={() => onMoveStage(flowIndex, 1)}
            />
          ))}

          <svg
            className="pointer-events-none absolute inset-0 z-[5]"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            aria-hidden
          >
            {connectors.map((path, index) => (
              <path
                key={`connector-${index}`}
                d={path}
                fill="none"
                stroke="rgba(96,165,250,0.35)"
                strokeWidth="2"
              />
            ))}
          </svg>

          {displayStages.map((stage, flowIndex) => {
            const nextStage = displayStages[flowIndex + 1];
            if (!nextStage) return null;
            const midpoint = connectorMidpoint(stage, nextStage);
            return (
              <NodeAddButton
                key={`insert-${stage.id}`}
                title="Insert stage"
                dataStageInsert="true"
                onClick={() => onInsertStageAfter(flowIndex)}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: midpoint.x, top: midpoint.y }}
                disabled={null}
                dataEpicAdd={null}
                dataNodeInsert={null}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
