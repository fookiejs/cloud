export function valueOrEmpty(value: string | null): string {
  if (value === null) {
    return "";
  }
  return value;
}

export function emptyToNull(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  if (value === "") {
    return null;
  }
  return value;
}
