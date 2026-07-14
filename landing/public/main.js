const AUTH = "https://auth.fookiecloud.com";
const CLIENT_ID = "web";
const REDIRECT_URI = "https://fookiecloud.com/callback";
const ACCESS_KEY = "fookie_access_token";
const REFRESH_KEY = "fookie_refresh_token";
const USER_KEY = "fookie_user";

const sheet = document.getElementById("signin-sheet");
const authSlot = document.getElementById("auth-slot");
const googleLogin = document.getElementById("google-login");

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

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

async function fetchUser(token) {
  const res = await fetch(`${AUTH}/v1/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("unauthorized");
  return res.json();
}

function setHeroAuthed(user) {
  const actions = document.querySelector(".hero-actions");
  if (!actions) return;
  const first = user.name?.split(/\s+/)[0] || "there";
  actions.innerHTML = `
    <a class="btn-solid large" href="#apps">Browse apps</a>
    <span class="btn-quiet">Hi, ${escapeHtml(first)}</span>
  `;
}

function renderAuthed(user) {
  setHeroAuthed(user);
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
}

function renderGuest() {
  authSlot.innerHTML = `
    <button class="btn-text" type="button" data-open-signin>Sign in</button>
    <button class="btn-solid" type="button" data-open-signin>Get started</button>
  `;
  bindOpeners();
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

document.querySelectorAll("[data-close-signin]").forEach((el) => {
  el.addEventListener("click", closeSheet);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !sheet.hidden) closeSheet();
});

if (googleLogin) {
  googleLogin.addEventListener("click", (e) => {
    e.preventDefault();
    location.href = loginUrl();
  });
}

bindOpeners();

(async () => {
  const token = localStorage.getItem(ACCESS_KEY);
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
