import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';

export interface SchedulerManager {
  schedule(taskId: string, expression: string, onTick: () => void): boolean;
  unschedule(taskId: string): void;
  stopAll(): void;
}

export function createScheduler(): SchedulerManager {
  const jobs = new Map<string, ScheduledTask>();

  return {
    schedule(taskId: string, expression: string, onTick: () => void): boolean {
      if (!cron.validate(expression)) {
        return false;
      }
      const existing = jobs.get(taskId);
      if (existing !== undefined) {
        void existing.stop();
      }
      const job = cron.schedule(expression, onTick);
      jobs.set(taskId, job);
      return true;
    },
    unschedule(taskId: string): void {
      const job = jobs.get(taskId);
      if (job === undefined) {
        return;
      }
      void job.stop();
      jobs.delete(taskId);
    },
    stopAll(): void {
      for (const job of jobs.values()) {
        void job.stop();
      }
      jobs.clear();
    },
  };
}
