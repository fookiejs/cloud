export function folderBaseName(p: string): string {
  const trimmed = p.replace(/[\\/]+$/, '');
  const parts = trimmed.split(/[\\/]/);
  const last = parts[parts.length - 1];
  if (last === undefined || last.length === 0) {
    return '';
  }
  return last;
}
