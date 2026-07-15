const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS']);

export function isAllowedBridgeMethod(method: string): boolean {
  return ALLOWED_METHODS.has(method.toUpperCase());
}

export function isAllowedBridgePath(rawPath: string): boolean {
  let pathOnly = rawPath.split('?')[0] ?? '';
  if (!pathOnly.startsWith('/')) {
    return false;
  }
  try {
    pathOnly = decodeURIComponent(pathOnly);
  } catch {
    return false;
  }
  if (pathOnly.includes('\\') || pathOnly.includes('\0')) {
    return false;
  }
  const parts = pathOnly.split('/');
  for (const part of parts) {
    if (part === '..') {
      return false;
    }
  }
  return pathOnly === '/api/v1' || pathOnly.startsWith('/api/v1/');
}
