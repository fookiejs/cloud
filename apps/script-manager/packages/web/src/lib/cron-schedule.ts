import { resolveCronExpression } from '@/lib/cron-presets';

const INTERVAL_MS: Readonly<Record<string, number>> = {
  '* * * * * *': 1000,
  '*/10 * * * * *': 10_000,
  '*/30 * * * * *': 30_000,
  '0 * * * * *': 60_000,
  '0 */2 * * * *': 120_000,
  '0 */3 * * * *': 180_000,
  '0 */4 * * * *': 240_000,
  '0 */5 * * * *': 300_000,
  '0 */10 * * * *': 600_000,
  '0 */15 * * * *': 900_000,
  '0 */20 * * * *': 1_200_000,
  '0 0 * * * *': 3_600_000,
  '0 0 */6 * * *': 21_600_000,
  '0 0 9 * * *': 86_400_000,
  '0 0 9 * * 1': 604_800_000,
  '0 0 9 1 * *': 2_592_000_000,
};

export function cronIntervalMs(expression: string): number {
  const ms = INTERVAL_MS[expression];
  if (ms !== undefined) {
    return ms;
  }
  return 300_000;
}

export function nextCronTickAt(expression: string, nowMs: number): number {
  const interval = cronIntervalMs(expression);
  return Math.ceil(nowMs / interval) * interval;
}

export function cronScheduleProgress(expression: string, nowMs: number): number {
  const interval = cronIntervalMs(expression);
  const next = nextCronTickAt(expression, nowMs);
  const prev = next - interval;
  const elapsed = nowMs - prev;
  if (interval <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, elapsed / interval));
}

export function formatCronCountdown(expression: string, nowMs: number): string {
  const next = nextCronTickAt(expression, nowMs);
  const remaining = Math.max(0, next - nowMs);
  if (remaining < 1000) {
    return '<1s';
  }
  if (remaining < 60_000) {
    return `${String(Math.ceil(remaining / 1000))}s`;
  }
  if (remaining < 3_600_000) {
    const m = Math.floor(remaining / 60_000);
    const s = Math.ceil((remaining % 60_000) / 1000);
    return `${String(m)}m ${String(s)}s`;
  }
  if (remaining < 86_400_000) {
    const h = Math.floor(remaining / 3_600_000);
    const m = Math.ceil((remaining % 3_600_000) / 60_000);
    return `${String(h)}h ${String(m)}m`;
  }
  const d = Math.floor(remaining / 86_400_000);
  const h = Math.ceil((remaining % 86_400_000) / 3_600_000);
  return `${String(d)}d ${String(h)}h`;
}

export function resolvedCronIntervalMs(stored: string | null): number {
  return cronIntervalMs(resolveCronExpression(stored));
}
