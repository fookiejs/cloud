const PROMETHEUS_URL = (process.env.PROMETHEUS_URL || "http://prometheus:9090").replace(/\/$/, "");
const TASK_BRIDGE_URL = (process.env.TASK_BRIDGE_URL || "https://task-bridge.fookiecloud.com").replace(/\/$/, "");
const FOOKIE_API_KEY = process.env.FOOKIE_API_KEY || "";
const TB_PROJECT_ID = process.env.TB_PROJECT_ID || "ops";
const CRON_MS = Number(process.env.OPS_INTERVAL_MS || 6 * 60 * 60 * 1000);
const RUN_ON_START = String(process.env.OPS_RUN_ON_START || "1") !== "0";
const WINDOW = process.env.OPS_WINDOW || "6h";

function log(msg) {
  process.stdout.write(`${new Date().toISOString()} ${msg}\n`);
}

async function promQuery(query) {
  const url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`prom ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.status !== "success") {
    throw new Error(`prom status=${data.status}`);
  }
  return data.data?.result || [];
}

function formatVector(result) {
  if (!result.length) return "(empty)";
  return result
    .map((row) => {
      const labels = Object.entries(row.metric || {})
        .filter(([k]) => k !== "__name__")
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      const value = Array.isArray(row.value) ? row.value[1] : "?";
      return `- ${labels || "series"} => ${value}`;
    })
    .join("\n");
}

async function collectSnapshot() {
  const queries = [
    { name: "up", query: 'up{job="fookie-apps"}' },
    { name: "up_stack", query: 'up{job=~"prometheus|otel-collector"}' },
    {
      name: "requests_total",
      query: `sum by (service) (increase(http_requests_total[${WINDOW}]))`,
    },
    {
      name: "requests_5xx",
      query: `sum by (service) (increase(http_requests_total{status_class="5xx"}[${WINDOW}]))`,
    },
    {
      name: "requests_4xx",
      query: `sum by (service) (increase(http_requests_total{status_class="4xx"}[${WINDOW}]))`,
    },
    {
      name: "in_flight",
      query: "http_requests_in_flight",
    },
  ];

  const sections = [];
  for (const q of queries) {
    try {
      const result = await promQuery(q.query);
      sections.push(`### ${q.name}\n\`\`\`\n${q.query}\n\`\`\`\n${formatVector(result)}`);
    } catch (err) {
      sections.push(`### ${q.name}\nERROR: ${String(err.message || err)}`);
    }
  }

  const now = new Date();
  const stamp = now.toISOString();
  const title = `[OPS] Metrics snapshot ${stamp.slice(0, 16).replace("T", " ")} UTC`;
  const description = [
    "## Objective",
    "Bu dilimin Prometheus snapshot'ı. Olası bug/hataları değerlendir, metriklerden anlamlı sonuç çıkar, gerekli özeti Notes'a yükle (title + düz metin). Kod değiştirme zorunlu değil; önce değerlendirme ve note.",
    "",
    "## Window",
    WINDOW,
    "",
    "## Collected at",
    stamp,
    "",
    "## Snapshot",
    ...sections,
    "",
    "## Notes API",
    "POST https://notes.fookiecloud.com/api/notes",
    'Body: { "title": "...", "body": "...", "source": "ops-eval" }',
    "Auth: Bearer FOOKIE_API_KEY or NOTES_WRITE_KEY",
  ].join("\n");

  return { title, description };
}

async function ensureProject() {
  const res = await fetch(`${TASK_BRIDGE_URL}/api/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FOOKIE_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      id: TB_PROJECT_ID,
      name: "Ops",
      description: "Internal metrics evaluation",
    }),
  });
  if (res.ok || res.status === 409) return;
  if (res.status === 400) return;
  const text = await res.text();
  log(`project ensure ${res.status}: ${text.slice(0, 200)}`);
}

async function createEpic(title, description) {
  const res = await fetch(`${TASK_BRIDGE_URL}/api/epics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FOOKIE_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      projectId: TB_PROJECT_ID,
      title,
      description,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`tb epic ${res.status}: ${text.slice(0, 400)}`);
  }
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  return data;
}

async function runOnce() {
  if (!FOOKIE_API_KEY) {
    throw new Error("FOOKIE_API_KEY missing");
  }
  await ensureProject();
  const snap = await collectSnapshot();
  const created = await createEpic(snap.title, snap.description);
  log(`epic_ok id=${created.id || "?"} title=${snap.title}`);
}

let running = false;
async function tick() {
  if (running) {
    log("skip overlapping run");
    return;
  }
  running = true;
  try {
    await runOnce();
  } catch (err) {
    log(`run_error ${String(err.message || err)}`);
  } finally {
    running = false;
  }
}

log(`ops-metrics start prom=${PROMETHEUS_URL} intervalMs=${CRON_MS} project=${TB_PROJECT_ID}`);
if (RUN_ON_START) {
  tick();
}
setInterval(tick, CRON_MS);
