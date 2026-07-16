# script

Local-first task orchestration for your machine. Define shell tasks on a project folder, trigger them on save, schedule, or manually, and watch logs in the browser.

## Run

```bash
npx -y @fookiejs/script@latest
```

Opens the local agent and stores data in `~/.script/`. Sign in when prompted to connect to https://script.fookiecloud.com.

### Requirements

- Node.js 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (only for **Docker** runtime tasks)

Shell tasks run on your machine (`gh`, `ollama`, `npm`, etc.). Use **Docker** runtime in a task for an isolated container.

### Environment variables

| Variable      | Default | Purpose   |
| ------------- | ------- | --------- |
| `SCRIPT_PORT` | `4317`  | HTTP port |
