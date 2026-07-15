import { incompleteSubtasks, type BridgeTask } from "../domain/task.js";
import { AppError } from "../errors/app-error.js";
import { listBridgeTasks } from "./task-service.js";

export function validateStageTransition(task: BridgeTask, stageId: string): void {
  if (stageId === task.stageId) return;
  const tasks = listBridgeTasks();
  const blocked = incompleteSubtasks(tasks, task.id);
  if (blocked.length === 0) return;
  throw new AppError(`Cannot move task: ${blocked.length} subtask(s) are not done`, 409, {
    subtasks: blocked.map((entry) => ({
      id: entry.id,
      title: entry.title,
      stageId: entry.stageId,
    })),
  });
}
