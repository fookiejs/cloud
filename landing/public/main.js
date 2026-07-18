const AUTH = "https://auth.fookiecloud.com";
const CLIENT_ID = "web";
const REDIRECT_URI = "https://fookiecloud.com/callback";
const ACCESS_KEY = "fookie_access_token";
const REFRESH_KEY = "fookie_refresh_token";
const USER_KEY = "fookie_user";
const PENDING_APP_KEY = "fookie_pending_app";
const AFTER_LOGIN_KEY = "fookie_after_login";
const OAUTH_STATE_KEY = "fookie_oauth_state";
const PKCE_VERIFIER_KEY = "fookie_pkce_verifier";

const APPS = {
  "script-manager": "/script/",
  "task-bridge": "/tasks/",
  notes: "/notes/",
};

const isProfile = document.body?.dataset?.page === "profile";
const sheet = document.getElementById("signin-sheet");
const keySheet = document.getElementById("key-sheet");
const profileSlot = document.getElementById("profile-slot");
const googleLogin = document.getElementById("google-login");
const keysList = document.getElementById("keys-list");
const profileCard = document.getElementById("profile-card");
const mcpSnippets = document.getElementById("mcp-snippets");

const FOOKIE_CLOUD_MCP = `{
  "mcpServers": {
    "fookie-cloud": {
      "command": "npx",
      "args": ["-y", "@umudik/fookie-cloud-mcp"],
      "env": {
        "FOOKIE_API_KEY": "<paste-key>",
        "NOTES_URL": "https://notes.fookiecloud.com",
        "TASK_BRIDGE_URL": "https://task.fookiecloud.com",
        "SCRIPT_API_URL": "https://script.fookiecloud.com"
      }
    }
  }
}`;

function base64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(hash));
}

async function loginUrl() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = await sha256(verifier);
  const state = crypto.randomUUID();
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTH}/v1/login?${q.toString()}`;
}

async function startSignIn(event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }
  if (isProfile) sessionStorage.setItem(AFTER_LOGIN_KEY, "/profile");
  location.href = await loginUrl();
}

function closeSheet() {
  if (!sheet) return;
  sheet.hidden = true;
  document.body.style.overflow = "";
}

function openKeySheet() {
  if (!keySheet) return;
  document.getElementById("key-form").hidden = false;
  document.getElementById("key-reveal").hidden = true;
  document.getElementById("key-name").value = "";
  document.getElementById("key-value").textContent = "";
  keySheet.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeKeySheet() {
  if (!keySheet) return;
  keySheet.hidden = true;
  document.body.style.overflow = "";
  const valueEl = document.getElementById("key-value");
  if (valueEl) valueEl.textContent = "";
  const form = document.getElementById("key-form");
  const reveal = document.getElementById("key-reveal");
  if (form) form.hidden = false;
  if (reveal) reveal.hidden = true;
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

async function requestApp(appKey) {
  if (!APPS[appKey]) return;
  const token = localStorage.getItem(ACCESS_KEY);
  if (token) {
    goToApp(appKey);
    return;
  }
  sessionStorage.setItem(PENDING_APP_KEY, appKey);
  await startSignIn();
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

function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
        : `<button class="btn-danger" data-revoke="${k.id}">Revoke</button>`;
      return `<li class="key-row${k.revoked ? " revoked" : ""}">
        <div class="meta">
          <strong>${escapeHtml(k.name)}</strong>
          <span>${escapeHtml(status)}</span>
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
  if (!keysList) return;
  try {
    const data = await loadKeys();
    renderKeys(data.keys || []);
  } catch {
    keysList.innerHTML = `<li class="keys-empty">Could not load API keys.</li>`;
  }
}

function renderMcpSnippets() {
  if (!mcpSnippets) return;
  mcpSnippets.innerHTML = `
    <div class="mcp-snippet-block">
      <div class="mcp-snippet-head">
        <strong>Fookie Cloud</strong>
        <button class="btn-outline btn-sm" type="button" data-copy-mcp="fookie-cloud">Copy</button>
      </div>
      <pre class="mcp-snippet-pre">${escapeHtml(FOOKIE_CLOUD_MCP)}</pre>
    </div>
  `;
  mcpSnippets.querySelectorAll("[data-copy-mcp]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(FOOKIE_CLOUD_MCP);
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 2000);
      } catch {
        alert("Could not copy");
      }
    });
  });
}

function renderProfileCard(user) {
  if (!profileCard) return;
  profileCard.innerHTML = `
    <div class="who">
      <strong>${escapeHtml(user.name || "Signed in")}</strong>
      <span>${escapeHtml(user.email || "")}</span>
    </div>
    <button class="btn-ghost" type="button" id="sign-out">Sign out</button>
  `;
  document.getElementById("sign-out").addEventListener("click", () => {
    clearSession();
    location.href = "/";
  });
}

function setAdminNav(user) {
  const show = Boolean(user && user.is_admin);
  document.querySelectorAll("[data-admin-app]").forEach((el) => {
    el.hidden = !show;
  });
}

function renderAuthed(user) {
  setAdminNav(user);
  const label = escapeHtml(user.name || user.email || "Account");
  const mail = escapeHtml(user.email || "");
  const name = escapeHtml(user.name || "Signed in");

  if (profileSlot) {
    const active = isProfile ? " is-active" : "";
    profileSlot.innerHTML = `
      <a class="profile-user${active}" href="/profile" aria-label="${label}">
        <span class="who">
          <strong>${name}</strong>
          <span>${mail}</span>
        </span>
      </a>
    `;
  }

  if (isProfile) {
    renderProfileCard(user);
    renderMcpSnippets();
    void refreshKeysPanel();
  }
}

function renderGuest() {
  setAdminNav(null);
  if (profileSlot) {
    const active = isProfile ? " is-active" : "";
    profileSlot.innerHTML = `<button class="nav-item${active}" type="button" data-signin>Sign in</button>`;
  }

  if (isProfile) {
    sessionStorage.setItem(AFTER_LOGIN_KEY, "/profile");
    if (profileCard) {
      profileCard.innerHTML = `
        <div class="who">
          <strong>Sign in required</strong>
          <span>API keys live on your profile.</span>
        </div>
        <button class="btn-solid" type="button" data-signin>Sign in with Google</button>
      `;
    }
    if (keysList) {
      keysList.innerHTML = `<li class="keys-empty">Sign in to manage API keys.</li>`;
    }
  }
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const signInEl = target.closest("[data-signin], [data-open-signin], #google-login");
  if (signInEl) {
    void startSignIn(event);
  }
});

document.querySelectorAll("[data-close-signin]").forEach((el) => {
  el.addEventListener("click", closeSheet);
});

document.querySelectorAll("[data-close-key]").forEach((el) => {
  el.addEventListener("click", closeKeySheet);
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (sheet && !sheet.hidden) closeSheet();
  if (keySheet && !keySheet.hidden) closeKeySheet();
});

if (googleLogin) {
  googleLogin.addEventListener("click", (e) => {
    e.preventDefault();
    void startSignIn(e);
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

(async () => {
  const pending = sessionStorage.getItem(PENDING_APP_KEY);
  const token = localStorage.getItem(ACCESS_KEY);

  if (!isProfile && token && pending && APPS[pending]) {
    try {
      await fetchUser(token);
      sessionStorage.removeItem(PENDING_APP_KEY);
      goToApp(pending);
      return;
    } catch {
      clearSession();
    }
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
