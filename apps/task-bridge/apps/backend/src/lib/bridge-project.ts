export const PROJECT_TAG_PATTERN = /^\[project:([^\]]+)\]\s*(?:\n\n?|\r\n\r\n?)?/;

export function withProjectMarker(projectId: string, description: string): string {
  const body = description;
  if (body) return `[project:${projectId}]\n\n${body}`;
  return `[project:${projectId}]`;
}

export function extractProjectId(description: string | null): string | null {
  if (!description) return null;
  const match = description.match(PROJECT_TAG_PATTERN);
  if (!match) return null;
  const id = match[1];
  if (!id) return null;
  return id || null;
}

export function stripProjectMarker(description: string | null): string | null {
  if (!description) return null;
  const stripped = description.replace(PROJECT_TAG_PATTERN, "");
  return stripped || null;
}
