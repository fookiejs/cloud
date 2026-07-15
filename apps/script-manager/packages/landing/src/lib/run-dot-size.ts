export function runDotPreviewSizeClass(index: number): string {
  if (index === 0) {
    return 'w-[10px] h-[10px]';
  }
  if (index === 1) {
    return 'w-[7px] h-[7px]';
  }
  if (index === 2) {
    return 'w-[6px] h-[6px]';
  }
  return 'w-[5px] h-[5px]';
}
