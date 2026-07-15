export function parseEnvVars(raw: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_e: unknown) {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return {};
  }
  const out: Record<string, string> = {};
  const obj = parsed as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      out[key] = val;
    }
  }
  return out;
}

export function stringifyEnvVars(vars: Record<string, string>): string {
  return JSON.stringify(vars);
}

function shellUtf8Env(): Record<string, string> {
  if (process.platform === 'win32') {
    return {
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
    };
  }
  return {};
}

export function buildExecEnv(
  custom: Record<string, string>,
  isolated: boolean,
): Record<string, string> {
  if (!isolated) {
    const merged: Record<string, string> = {};
    for (const key of Object.keys(process.env)) {
      const val = process.env[key];
      if (val !== undefined) {
        merged[key] = val;
      }
    }
    const utf8Env = shellUtf8Env();
    for (const key of Object.keys(utf8Env)) {
      const val = utf8Env[key];
      if (val !== undefined) {
        merged[key] = val;
      }
    }
    for (const key of Object.keys(custom)) {
      const val = custom[key];
      if (val !== undefined) {
        merged[key] = val;
      }
    }
    return merged;
  }
  const base: Record<string, string> = {
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    HOME: '/root',
    LANG: 'C.UTF-8',
  };
  for (const key of Object.keys(custom)) {
    const val = custom[key];
    if (val !== undefined) {
      base[key] = val;
    }
  }
  return base;
}

export function envToDockerList(env: Record<string, string>): string[] {
  const list: string[] = [];
  for (const key of Object.keys(env)) {
    const val = env[key];
    if (val === undefined) {
      continue;
    }
    list.push(`${key}=${val}`);
  }
  return list;
}

export function envKeySummary(env: Record<string, string>): string {
  const keys = Object.keys(env);
  if (keys.length === 0) {
    return '';
  }
  return keys.join(',');
}
