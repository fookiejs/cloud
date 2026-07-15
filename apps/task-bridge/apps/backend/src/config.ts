function getEnv(key: string): string | null {
  const keys = Object.keys(process.env);
  for (let i = 0; i < keys.length; i += 1) {
    const envKey = keys[i];
    if (envKey !== key) {
      continue;
    }
    const value = process.env[envKey];
    if (value === null) {
      return null;
    }
    return value as string;
  }
  return null;
}

let configPort = 3000;
if ("PORT" in process.env) {
  const rawPort = process.env["PORT"];
  if (rawPort !== null) {
    configPort = Number(rawPort);
  }
}

const fookieAuthIssuer = getEnv("FOOKIE_AUTH_ISSUER") || "https://auth.fookiecloud.com";
const taskBridgeClientId = getEnv("TASK_BRIDGE_CLIENT_ID") || "task-bridge";
const fookieMode = getEnv("FOOKIE_MODE") !== "0";
const fookieIntrospectSecret = getEnv("FOOKIE_INTROSPECT_SECRET") || "";
const metricsToken = getEnv("METRICS_TOKEN") || "";
const allowedOrigins = (getEnv("ALLOWED_ORIGINS") || "https://task-bridge.fookiecloud.com")
  .split(",")
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

export const config = {
  port: configPort,
  databasePath: getEnv("DATABASE_PATH") || getEnv("BRIDGE_DB_PATH") || "",
  fookieAuthIssuer,
  taskBridgeClientId,
  fookieMode,
  fookieIntrospectSecret,
  metricsToken,
  allowedOrigins,
};
