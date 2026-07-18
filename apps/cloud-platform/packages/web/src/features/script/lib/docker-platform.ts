export const DOCKER_PLATFORM_OPTIONS = [
  { value: 'auto', label: 'Auto (Docker default)' },
  { value: 'linux/amd64', label: 'linux/amd64 (Intel / AMD64)' },
  { value: 'linux/arm64', label: 'linux/arm64 (ARM64)' },
] as const;

export function platformSelectValue(platform: string | null): string {
  if (platform === null || platform.length === 0) {
    return 'auto';
  }
  return platform;
}
