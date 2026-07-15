export type DemoStatus = 'running' | 'success' | 'failed' | 'cancelled' | 'pending' | 'idle';

export function statusDotClass(s: DemoStatus): string {
  if (s === 'running') {
    return 'bg-primary';
  }
  if (s === 'success') {
    return 'bg-success';
  }
  if (s === 'failed') {
    return 'bg-destructive';
  }
  if (s === 'cancelled') {
    return 'bg-warn';
  }
  if (s === 'pending') {
    return 'bg-muted-foreground';
  }
  return 'bg-muted';
}

export function statusBadgeClass(s: DemoStatus): string {
  if (s === 'running') {
    return 'bg-primary/15 text-primary border-primary/25';
  }
  if (s === 'success') {
    return 'bg-success/15 text-success border-success/25';
  }
  if (s === 'failed') {
    return 'bg-destructive/15 text-destructive border-destructive/25';
  }
  return 'bg-muted text-muted-foreground border-border';
}
