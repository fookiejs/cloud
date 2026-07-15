const TOKEN_KEY = "fookie_notes_token";

const listEl = document.getElementById("note-list");
const emptyEl = document.getElementById("empty");
const detailEl = document.getElementById("detail");
const unreadEl = document.getElementById("unread-count");
const authBox = document.getElementById("auth-box");
const tokenInput = document.getElementById("token-input");
const btnSave = document.getElementById("btn-save-token");
const btnLogout = document.getElementById("btn-logout");
const btnRefresh = document.getElementById("btn-refresh");
const btnBack = document.getElementById("btn-back");
const btnSeen = document.getElementById("btn-seen");
const detailTitle = document.getElementById("detail-title");
const detailMeta = document.getElementById("detail-meta");
const detailBody = document.getElementById("detail-body");

let selectedId = null;
let notesCache = [];

function token() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(value) {
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
  syncAuthUi();
}

function syncAuthUi() {
  const has = Boolean(token());
  authBox.hidden = has;
  btnLogout.hidden = !has;
}

async function api(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    setToken("");
    throw new Error("unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `http ${res.status}`);
  return data;
}

function fmt(iso) {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function renderList() {
  listEl.innerHTML = "";
  const unread = notesCache.filter((n) => !n.seen).length;
  unreadEl.hidden = unread === 0;
  unreadEl.textContent = String(unread);
  emptyEl.hidden = notesCache.length > 0;
  for (const n of notesCache) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "note-item";
    btn.innerHTML = `
      <span class="dot ${n.seen ? "" : "is-unread"}"></span>
      <span>
        <p class="note-title"></p>
        <p class="note-sub"></p>
      </span>
      <span class="note-time"></span>
    `;
    btn.querySelector(".note-title").textContent = n.title;
    btn.querySelector(".note-sub").textContent = n.source || "note";
    btn.querySelector(".note-time").textContent = fmt(n.createdAt);
    btn.addEventListener("click", () => openNote(n.id));
    li.appendChild(btn);
    listEl.appendChild(li);
  }
}

async function loadNotes() {
  if (!token()) {
    notesCache = [];
    renderList();
    detailEl.hidden = true;
    return;
  }
  const data = await api("/api/notes");
  notesCache = data.notes || [];
  renderList();
}

async function openNote(id) {
  selectedId = id;
  const note = await api(`/api/notes/${id}`);
  listEl.hidden = true;
  emptyEl.hidden = true;
  detailEl.hidden = false;
  detailTitle.textContent = note.title;
  detailMeta.textContent = `${note.source || "note"} · ${fmt(note.createdAt)}${note.seenAt ? ` · görüldü ${fmt(note.seenAt)}` : ""}`;
  detailBody.textContent = note.body || "";
  btnSeen.textContent = note.seenAt ? "Görülmedi yap" : "Görüldü";
}

btnBack.addEventListener("click", () => {
  selectedId = null;
  detailEl.hidden = true;
  listEl.hidden = false;
  loadNotes().catch((err) => {
    emptyEl.hidden = false;
    emptyEl.textContent = err.message;
  });
});

btnSeen.addEventListener("click", async () => {
  if (!selectedId) return;
  const current = notesCache.find((n) => n.id === selectedId);
  const seen = !(current && current.seen);
  await api(`/api/notes/${selectedId}`, {
    method: "PATCH",
    body: JSON.stringify({ seen }),
  });
  await openNote(selectedId);
  await loadNotes();
});

btnSave.addEventListener("click", async () => {
  const value = tokenInput.value.trim();
  if (!value) return;
  setToken(value);
  tokenInput.value = "";
  try {
    await loadNotes();
  } catch (err) {
    emptyEl.hidden = false;
    emptyEl.textContent = err.message;
  }
});

btnLogout.addEventListener("click", () => {
  setToken("");
  notesCache = [];
  renderList();
  detailEl.hidden = true;
});

btnRefresh.addEventListener("click", () => {
  loadNotes().catch((err) => {
    emptyEl.hidden = false;
    emptyEl.textContent = err.message;
  });
});

syncAuthUi();
loadNotes().catch((err) => {
  emptyEl.hidden = false;
  emptyEl.textContent = err.message;
});
