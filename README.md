# Fookie Cloud

Monorepo for Fookie Cloud apps.

## Apps

| Path | Product |
|------|---------|
| `apps/script-manager` | Script Manager (formerly Lotaru) — local agent + cloud gateway |
| `apps/task-bridge` | Task Bridge |
| `auth` | Shared OIDC / Google auth |
| `landing` | fookiecloud.com |
| `notes` | Notes inbox |
| `observability` | Grafana / Prometheus / Loki |

## Packages

| Path | Role |
|------|------|
| `packages/shared` | Shared TypeScript constants / OAuth client configs |
| `packages/mcp` | Unified Cursor MCP (`@umudik/fookie-cloud-mcp`) |

## Script Manager agent (no npm publish)

```bash
git clone --depth 1 https://github.com/fookiejs/cloud.git
cd cloud/apps/script-manager
npm ci
npm start
```

Domain: `https://script.fookiecloud.com` (legacy `lotaru.fookiecloud.com` still accepted).
