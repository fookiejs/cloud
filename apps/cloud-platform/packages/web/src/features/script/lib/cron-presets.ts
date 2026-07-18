export interface CronPreset {
  label: string;
  expression: string;
}

export const CRON_PRESETS: readonly CronPreset[] = [
  { label: 'Every 1 second', expression: '* * * * * *' },
  { label: 'Every 10 seconds', expression: '*/10 * * * * *' },
  { label: 'Every 30 seconds', expression: '*/30 * * * * *' },
  { label: 'Every 1 minute', expression: '0 * * * * *' },
  { label: 'Every 2 minutes', expression: '0 */2 * * * *' },
  { label: 'Every 3 minutes', expression: '0 */3 * * * *' },
  { label: 'Every 4 minutes', expression: '0 */4 * * * *' },
  { label: 'Every 5 minutes', expression: '0 */5 * * * *' },
  { label: 'Every 10 minutes', expression: '0 */10 * * * *' },
  { label: 'Every 15 minutes', expression: '0 */15 * * * *' },
  { label: 'Every 20 minutes', expression: '0 */20 * * * *' },
  { label: 'Every hour', expression: '0 0 * * * *' },
  { label: 'Every 6 hours', expression: '0 0 */6 * * *' },
  { label: 'Every day', expression: '0 0 9 * * *' },
  { label: 'Every week', expression: '0 0 9 * * 1' },
  { label: 'Every month', expression: '0 0 9 1 * *' },
];

export const DEFAULT_CRON_EXPRESSION = '0 */5 * * * *';

export function resolveCronExpression(stored: string | null): string {
  if (stored === null || stored.length === 0) {
    return DEFAULT_CRON_EXPRESSION;
  }
  for (const p of CRON_PRESETS) {
    if (p.expression === stored) {
      return stored;
    }
  }
  return DEFAULT_CRON_EXPRESSION;
}

export function cronPresetLabel(expression: string): string {
  for (const p of CRON_PRESETS) {
    if (p.expression === expression) {
      return p.label;
    }
  }
  return 'Every 5 minutes';
}
