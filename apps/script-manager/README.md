# lotaru

Local-first task orchestration for your machine. Define shell tasks on a project folder, trigger them on save, schedule, or manually, and watch logs in the browser.

## Run

```bash
git clone --depth 1 https://github.com/fookiejs/cloud.git && cd cloud/apps/script-manager && npm ci && npm start
```

Opens http://127.0.0.1:4317 and stores data in `~/.lotaru/`.

### Requirements

- Node.js 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (only for **Docker** runtime tasks)

Shell tasks run on your machine (`gh`, `ollama`, `npm`, etc.). Use **Docker** runtime in a task for an isolated container.

### Environment variables

| Variable      | Default | Purpose   |
| ------------- | ------- | --------- |
| `LOTARU_PORT` | `4317`  | HTTP port |
