const AUTH = "https://auth.fookiecloud.com";
const CLIENT_ID = "web";
const REDIRECT_URI = "https://fookiecloud.com/callback";
const ACCESS_KEY = "fookie_access_token";
const REFRESH_KEY = "fookie_refresh_token";
const USER_KEY = "fookie_user";
const PENDING_APP_KEY = "fookie_pending_app";
const AFTER_LOGIN_KEY = "fookie_after_login";

const APPS = {
  lotaru: "https://lotaru.fookiecloud.com",
  "task-bridge": "https://task-bridge.fookiecloud.com",
};

const isProfile = document.body?.dataset?.page === "profile";
const sheet = document.getElementById("signin-sheet");
const keySheet = document.getElementById("key-sheet");
const authSlot = document.getElementById("auth-slot");
const profileSlot = document.getElementById("profile-slot");
const googleLogin = document.getElementById("google-login");
const keysList = document.getElementById("keys-list");
const profileCard = document.getElementById("profile-card");
const headerEl = document.getElementById("top");

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

function startSignIn() {
  if (isProfile) sessionStorage.setItem(AFTER_LOGIN_KEY, "/profile");
  location.href = loginUrl();
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

function requestApp(appKey) {
  if (!APPS[appKey]) return;
  if (isAuthed()) {
    goToApp(appKey);
    return;
  }
  sessionStorage.setItem(PENDING_APP_KEY, appKey);
  startSignIn();
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

function avatarMarkup(user, size) {
  const initials = (user.name || user.email || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
  if (user.picture) {
    return `<img src="${user.picture}" alt="" width="${size}" height="${size}" referrerpolicy="no-referrer" />`;
  }
  return `<img alt="" width="${size}" height="${size}" src="data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect fill='%2327272a' width='64' height='64'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' fill='%23fafafa' font-family='sans-serif' font-size='22' font-weight='700'>${initials}</text></svg>`,
  )}" />`;
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
        : `<button type="button" class="btn-danger" data-revoke="${k.id}">Revoke</button>`;
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

function renderProfileCard(user) {
  if (!profileCard) return;
  profileCard.innerHTML = `
    ${avatarMarkup(user, 52)}
    <div class="who">
      <strong>${escapeHtml(user.name || "Signed in")}</strong>
      <span>${escapeHtml(user.email || "")}</span>
    </div>
  `;
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
        <span class="avatar-wrap">${avatarMarkup(user, 28)}</span>
        <span class="who">
          <strong>${name}</strong>
          <span>${mail}</span>
        </span>
      </a>
    `;
  }

  if (authSlot) {
    authSlot.innerHTML = `
      <div class="user-menu" id="user-menu">
        <button class="user-chip" type="button" id="user-chip" aria-label="${label}" aria-haspopup="true" aria-expanded="false">
          <span class="avatar-wrap">${avatarMarkup(user, 32)}</span>
        </button>
        <div class="user-menu-panel" role="menu">
          <div class="user-menu-who">
            <span class="name">${name}</span>
            <span class="mail">${mail}</span>
          </div>
          <a href="/profile" role="menuitem">Profile</a>
          <button type="button" class="sign-out" id="sign-out" role="menuitem">Sign out</button>
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
      location.href = "/";
    });
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) menu.classList.remove("open");
    });
  }

  if (isProfile) {
    renderProfileCard(user);
    void refreshKeysPanel();
  }
}

function renderGuest() {
  setAdminNav(null);
  if (profileSlot) {
    const active = isProfile ? " is-active" : "";
    profileSlot.innerHTML = `<a class="nav-item${active}" href="/profile" data-signin>Profile</a>`;
  }
  if (authSlot) {
    authSlot.innerHTML = `
      <button class="btn-ghost" type="button" data-signin>Sign in</button>
    `;
  }
  bindOpeners();

  if (isProfile) {
    sessionStorage.setItem(AFTER_LOGIN_KEY, "/profile");
    if (profileCard) {
      profileCard.innerHTML = `<div class="who"><strong>Sign in required</strong><span>API keys live on your profile.</span></div>`;
    }
    if (keysList) {
      keysList.innerHTML = `<li class="keys-empty">Sign in to manage API keys.</li>`;
    }
  }
}

function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bindOpeners() {
  document.querySelectorAll("[data-signin], [data-open-signin]").forEach((el) => {
    el.addEventListener("click", startSignIn);
  });
}

function bindApps() {
  document.querySelectorAll("[data-app]").forEach((el) => {
    el.addEventListener("click", () => requestApp(el.getAttribute("data-app")));
  });
}

if (headerEl) {
  const onScroll = () => {
    headerEl.classList.toggle("is-scrolled", window.scrollY > 4);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

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
    startSignIn();
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

  if (!isProfile && token && pending && APPS[pending]) {
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
