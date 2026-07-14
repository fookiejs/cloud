const AUTH = "https://auth.fookiecloud.com";
const CLIENT_ID = "web";
const REDIRECT_URI = "https://fookiecloud.com/callback";
const ACCESS_KEY = "fookie_access_token";
const REFRESH_KEY = "fookie_refresh_token";
const USER_KEY = "fookie_user";
const PENDING_APP_KEY = "fookie_pending_app";

const APPS = {
  lotaru: "https://lotaru.fookiecloud.com",
  "task-bridge": "https://task-bridge.fookiecloud.com",
};

const sheet = document.getElementById("signin-sheet");
const keySheet = document.getElementById("key-sheet");
const authSlot = document.getElementById("auth-slot");
const googleLogin = document.getElementById("google-login");
const keysPanel = document.getElementById("keys-panel");
const keysList = document.getElementById("keys-list");

function loginUrl() {
  const state = crypto.randomUUID();
  localStorage.setItem("fookie_oauth_state", state);
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state,
  });
  return `${AUTH}/v1/login?${q.toString()}`;
}

function openSheet() {
  sheet.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeSheet() {
  sheet.hidden = true;
  document.body.style.overflow = "";
}

function openKeySheet() {
  document.getElementById("key-form").hidden = false;
  document.getElementById("key-reveal").hidden = true;
  document.getElementById("key-name").value = "";
  document.getElementById("key-value").textContent = "";
  keySheet.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeKeySheet() {
  keySheet.hidden = true;
  document.body.style.overflow = "";
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function authHeader() {
  const token = localStorage.getItem(ACCESS_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clearSession() {
  const refresh = localStorage.getItem(REFRESH_KEY);
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  fetch(`${AUTH}/v1/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ refresh_token: refresh || undefined, all_devices: true }),
  }).catch(() => {});
}

function isAuthed() {
  return Boolean(localStorage.getItem(ACCESS_KEY));
}

function goToApp(appKey) {
  const url = APPS[appKey];
  if (!url) return;
  location.href = url;
}

function requestApp(appKey) {
  if (!APPS[appKey]) return;
  if (isAuthed()) {
    goToApp(appKey);
    return;
  }
  sessionStorage.setItem(PENDING_APP_KEY, appKey);
  openSheet();
}

async function fetchUser(token) {
  const res = await fetch(`${AUTH}/v1/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("unauthorized");
  return res.json();
}

async function loadKeys() {
  const res = await fetch(`${AUTH}/v1/api-keys`, {
    headers: { ...authHeader() },
  });
  if (!res.ok) throw new Error("failed to load keys");
  return res.json();
}

async function createKey(name) {
  const res = await fetch(`${AUTH}/v1/api-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "create failed");
  }
  return res.json();
}

async function revokeKey(id) {
  const res = await fetch(`${AUTH}/v1/api-keys/${id}`, {
    method: "DELETE",
    headers: { ...authHeader() },
  });
  if (!res.ok) throw new Error("revoke failed");
}

function renderKeys(keys) {
  if (!keysList) return;
  if (!keys.length) {
    keysList.innerHTML = `<li class="keys-empty">No API keys yet.</li>`;
    return;
  }
  keysList.innerHTML = keys
    .map((k) => {
      const status = k.revoked ? "revoked" : `expires ${k.expires_at.slice(0, 10)}`;
      const action = k.revoked
        ? ""
        : `<button type="button" class="btn-quiet" data-revoke="${k.id}">Revoke</button>`;
      return `<li class="key-row${k.revoked ? " revoked" : ""}">
        <div class="meta">
          <strong>${escapeHtml(k.name)}</strong>
          <span>${escapeHtml(k.prefix)}… · ${escapeHtml(status)}</span>
        </div>
        ${action}
      </li>`;
    })
    .join("");

  keysList.querySelectorAll("[data-revoke]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-revoke");
      if (!id || !confirm("Revoke this API key?")) return;
      try {
        await revokeKey(id);
        await refreshKeysPanel();
      } catch {
        alert("Could not revoke key");
      }
    });
  });
}

async function refreshKeysPanel() {
  if (!keysPanel) return;
  keysPanel.hidden = false;
  try {
    const data = await loadKeys();
    renderKeys(data.keys || []);
  } catch {
    keysList.innerHTML = `<li class="keys-empty">Could not load API keys.</li>`;
  }
}

function hideKeysPanel() {
  if (keysPanel) keysPanel.hidden = true;
}

function renderAuthed(user) {
  const initials = (user.name || user.email || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  authSlot.innerHTML = `
    <div class="user-menu" id="user-menu">
      <button class="user-chip" type="button" id="user-chip" aria-haspopup="true" aria-expanded="false">
        ${
          user.picture
            ? `<img src="${user.picture}" alt="" referrerpolicy="no-referrer" />`
            : `<img alt="" src="data:image/svg+xml,${encodeURIComponent(
                `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect fill='%231f4d3a' width='64' height='64'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' fill='%23fff' font-family='sans-serif' font-size='24' font-weight='700'>${initials}</text></svg>`
              )}" />`
        }
        <span class="meta">
          <span class="name">${escapeHtml(user.name || "Signed in")}</span>
          <span class="mail">${escapeHtml(user.email || "")}</span>
        </span>
      </button>
      <div class="user-menu-panel" role="menu">
        <button type="button" id="sign-out">Sign out</button>
      </div>
    </div>
  `;

  const menu = document.getElementById("user-menu");
  const chip = document.getElementById("user-chip");
  chip.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    chip.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.getElementById("sign-out").addEventListener("click", () => {
    clearSession();
    location.reload();
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) menu.classList.remove("open");
  });
  void refreshKeysPanel();
}

function renderGuest() {
  authSlot.innerHTML = `
    <button class="btn-text" type="button" data-open-signin>Sign in</button>
    <button class="btn-solid" type="button" data-open-signin>Get started</button>
  `;
  bindOpeners();
  hideKeysPanel();
}

function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bindOpeners() {
  document.querySelectorAll("[data-open-signin]").forEach((el) => {
    el.addEventListener("click", openSheet);
  });
}

function bindApps() {
  document.querySelectorAll("[data-app]").forEach((el) => {
    el.addEventListener("click", () => requestApp(el.getAttribute("data-app")));
  });
}

document.querySelectorAll("[data-close-signin]").forEach((el) => {
  el.addEventListener("click", closeSheet);
});

document.querySelectorAll("[data-close-key]").forEach((el) => {
  el.addEventListener("click", closeKeySheet);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!sheet.hidden) closeSheet();
    if (keySheet && !keySheet.hidden) closeKeySheet();
  }
});

if (googleLogin) {
  googleLogin.addEventListener("click", (e) => {
    e.preventDefault();
    location.href = loginUrl();
  });
}

const createKeyBtn = document.getElementById("create-key");
if (createKeyBtn) {
  createKeyBtn.addEventListener("click", openKeySheet);
}

const keySubmit = document.getElementById("key-submit");
if (keySubmit) {
  keySubmit.addEventListener("click", async () => {
    const name = document.getElementById("key-name").value.trim();
    if (!name) return;
    keySubmit.disabled = true;
    try {
      const created = await createKey(name);
      document.getElementById("key-form").hidden = true;
      document.getElementById("key-reveal").hidden = false;
      document.getElementById("key-value").textContent = created.key;
      await refreshKeysPanel();
    } catch {
      alert("Could not create key");
    } finally {
      keySubmit.disabled = false;
    }
  });
}

const keyCopy = document.getElementById("key-copy");
if (keyCopy) {
  keyCopy.addEventListener("click", async () => {
    const value = document.getElementById("key-value").textContent;
    await navigator.clipboard.writeText(value);
    keyCopy.textContent = "Copied";
    setTimeout(() => {
      keyCopy.textContent = "Copy";
    }, 1500);
  });
}

bindOpeners();
bindApps();

(async () => {
  const pending = sessionStorage.getItem(PENDING_APP_KEY);
  const token = localStorage.getItem(ACCESS_KEY);

  if (token && pending && APPS[pending]) {
    sessionStorage.removeItem(PENDING_APP_KEY);
    goToApp(pending);
    return;
  }

  if (!token) {
    renderGuest();
    return;
  }
  try {
    const cached = getUser();
    if (cached) renderAuthed(cached);
    const user = await fetchUser(token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    renderAuthed(user);
  } catch {
    clearSession();
    renderGuest();
  }
})();
