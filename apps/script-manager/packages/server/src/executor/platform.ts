export const DOCKER_PLATFORMS = ['linux/amd64', 'linux/arm64'] as const;

export type DockerPlatform = (typeof DOCKER_PLATFORMS)[number];

export function isDockerPlatform(v: string): v is DockerPlatform {
  if (v === 'linux/amd64') {
    return true;
  }
  if (v === 'linux/arm64') {
    return true;
  }
  return false;
}

export const INVALID_DOCKER_PLATFORM = 'invalid docker_platform' as const;

export type ParseDockerPlatformResult = DockerPlatform | null | typeof INVALID_DOCKER_PLATFORM;

export function parseDockerPlatformInput(v: unknown): ParseDockerPlatformResult {
  if (v === undefined || v === null || v === '') {
    return null;
  }
  if (typeof v !== 'string') {
    return INVALID_DOCKER_PLATFORM;
  }
  if (v === 'auto') {
    return null;
  }
  if (isDockerPlatform(v)) {
    return v;
  }
  return INVALID_DOCKER_PLATFORM;
}

export function resolveTaskPlatform(taskPlatform: string | null): string | null {
  if (taskPlatform !== null && taskPlatform.length > 0) {
    return taskPlatform;
  }
  const env = process.env['LOTARU_DOCKER_PLATFORM'];
  if (typeof env === 'string' && env.length > 0 && isDockerPlatform(env)) {
    return env;
  }
  return null;
}
