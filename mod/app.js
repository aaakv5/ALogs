const API_BASE = "https://logs.arcanomc.pw";
const REFRESH_MS = 5000;
const PER_PAGE = 50;
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

let currentTab = "grim";
let cache = { grim: [], vulcan: [], matrix: [], chat: [], commands: [], votes: [] };
let searchQuery = "";
let selectedDate = todayKey();
let selectedServer = "";
let serversList = [];
let pages = { grim: 1, vulcan: 1, matrix: 1, chat: 1, commands: 1, votes: 1, search: 1 };
let dataInterval = null;

function el(id) { return document.getElementById(id); }
function pad2(n) { return n < 10 ? "0" + n : "" + n; }

function todayKey() {
  const d = new Date(Date.now() + MSK_OFFSET_MS);
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
}

function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtFull(ts) {
  if (ts === null || ts === undefined || ts === "") return "—";
  let ms;
  if (typeof ts === "number") ms = ts;
  else {
    ms = Date.parse(ts);
    if (isNaN(ms)) return String(ts);
  }
  const d = new Date(ms + MSK_OFFSET_MS);
  return pad2(d.getUTCDate()) + "." + pad2(d.getUTCMonth() + 1) + "." + d.getUTCFullYear()
    + " " + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes()) + ":" + pad2(d.getUTCSeconds());
}

function parseMsk(dtStr) {
  if (!dtStr) return 0;
  const m = String(dtStr).match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return 0;
  const y = +m[3], mo = +m[2] - 1, d = +m[1], h = +m[4], mi = +m[5], s = +m[6];
  return Date.UTC(y, mo, d, h, mi, s) - MSK_OFFSET_MS;
}

function vlClass(vl) {
  const v = Number(vl) || 0;
  if (v >= 10) return "high";
  if (v >= 3) return "";
  return "low";
}

function currentServerLabel() {
  return selectedServer || "—";
}

function normalizeGrim(r) {
  const time = r.occurred_at || r.created_at;
  const player = r.player_name || r.player || r.username || r.uuid || "—";
  const reason = r.check_display || r.check_key || r.check_name || "—";

  const parts = [];
  if (r.check_desc) parts.push(r.check_desc);
  if (r.client_brand) {
    parts.push("client: " + (r.client_pvn ? r.client_brand + " " + r.client_pvn : r.client_brand));
  }

  return {
    date: typeof time === "number" ? fmtFull(time) : (time ? String(time) : "—"),
    player: String(player),
    reason: String(reason),
    detail: parts.join(" • "),
    vl: r.vl != null ? r.vl : (r.violations != null ? r.violations : 0),
    ping: r.ping != null ? r.ping : "—",
    source: "grim",
    server: currentServerLabel(),
    _ts: typeof time === "number" ? time : 0
  };
}

function normalizeVulcan(r) {
  const dt = ((r.date || "—") + " " + (r.time || "")).trim();
  const reason = r.check ? (r.check + " (Type " + (r.type || "") + ")") : "—";

  const parts = [];
  if (r.extra) parts.push(r.extra);
  if (r.client) parts.push("client: " + r.client);
  if (r.version) parts.push("v" + r.version);

  return {
    date: dt || "—",
    player: String(r.player || "—"),
    reason: reason,
    detail: parts.join(" • "),
    vl: r.vl != null ? r.vl : 0,
    ping: r.ping != null ? r.ping : "—",
    source: "vulcan",
    server: currentServerLabel(),
    _ts: parseMsk(dt)
  };
}

function normalizeMatrix(r) {
  const raw = r.time || "";
  return {
    date: raw || "—",
    player: String(r.player || "—"),
    reason: String(r.category || "—"),
    detail: r.detail ? (r.detail + " [" + (r.component || "") + "]") : "—",
    vl: r.vl != null ? r.vl : 0,
    ping: r.ping != null ? r.ping : "—",
    source: "matrix",
    server: currentServerLabel(),
    _ts: parseMsk(raw)
  };
}

function normalizeChat(r) {
  const ts = r.timestamp || 0;
  return {
    date: fmtFull(ts),
    player: String(r.player || "—"),
    world: String(r.world || "—"),
    reason: String(r.world || "—"),
    detail: String(r.message || ""),
    vl: "—",
    ping: "—",
    source: "chat",
    server: currentServerLabel(),
    _ts: ts
  };
}

function normalizeCommand(r) {
  const ts = r.timestamp || 0;
  return {
    date: fmtFull(ts),
    player: String(r.player || "—"),
    world: String(r.world || "—"),
    reason: String(r.world || "—"),
    detail: "/" + String(r.command || ""),
    vl: "—",
    ping: "—",
    source: "commands",
    server: currentServerLabel(),
    _ts: ts
  };
}

function normalizeVote(r) {
  const ts = r.timestamp || 0;
  return {
    date: fmtFull(ts),
    player: String(r.player || "—"),
    reason: String(r.answer || "—"),
    detail: String(r.question || "—"),
    source: "votes",
    server: currentServerLabel(),
    _ts: ts
  };
}

function normalizeAll() {
  return {
    grim:     (cache.grim     || []).map(normalizeGrim),
    vulcan:   (cache.vulcan   || []).map(normalizeVulcan),
    matrix:   (cache.matrix   || []).map(normalizeMatrix),
    chat:     (cache.chat     || []).map(normalizeChat),
    commands: (cache.commands || []).map(normalizeCommand),
    votes:    (cache.votes    || []).map(normalizeVote)
  };
}

function sortByTs(a, b) { return (b._ts || 0) - (a._ts || 0); }

function renderTable(rows, emptyText) {
  if (!rows.length) {
    return '<div class="feed-empty">' + escapeHtml(emptyText || "Нет данных") + '</div>';
  }
  let html = '<table class="feed-table"><thead><tr>';
  html += '<th class="col-time">Дата</th>';
  html += '<th class="col-player">Игрок</th>';
  html += '<th class="col-server">Сервер</th>';
  html += '<th class="col-source">Источник</th>';
  html += '<th class="col-type">Причина</th>';
  html += '<th class="col-detail">Детали</th>';
  html += '<th class="col-vl">VL</th>';
  html += '<th class="col-ping">Пинг</th>';
  html += '</tr></thead><tbody>';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    html += '<tr>'
      + '<td class="col-time">' + escapeHtml(r.date) + '</td>'
      + '<td class="col-player">' + escapeHtml(r.player) + '</td>'
      + '<td class="col-server"><span class="server-badge">' + escapeHtml(r.server || "—") + '</span></td>'
      + '<td class="col-source"><span class="source-badge source-' + r.source + '">' + escapeHtml(r.source) + '</span></td>'
      + '<td class="col-type">' + escapeHtml(r.reason) + '</td>'
      + '<td class="col-detail">' + escapeHtml(r.detail) + '</td>'
      + '<td class="col-vl"><span class="vl-badge ' + vlClass(r.vl) + '">' + escapeHtml(r.vl) + '</span></td>'
      + '<td class="col-ping">' + escapeHtml(r.ping) + '</td>'
      + '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderChatTable(rows, emptyText) {
  if (!rows.length) {
    return '<div class="feed-empty">' + escapeHtml(emptyText || "Нет данных") + '</div>';
  }
  let html = '<table class="feed-table"><thead><tr>';
  html += '<th class="col-time">Дата</th>';
  html += '<th class="col-player">Игрок</th>';
  html += '<th class="col-server">Сервер</th>';
  html += '<th class="col-source">Источник</th>';
  html += '<th class="col-world">Мир</th>';
  html += '<th class="col-detail">Сообщение</th>';
  html += '</tr></thead><tbody>';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    html += '<tr>'
      + '<td class="col-time">' + escapeHtml(r.date) + '</td>'
      + '<td class="col-player">' + escapeHtml(r.player) + '</td>'
      + '<td class="col-server"><span class="server-badge">' + escapeHtml(r.server || "—") + '</span></td>'
      + '<td class="col-source"><span class="source-badge source-' + r.source + '">' + escapeHtml(r.source) + '</span></td>'
      + '<td class="col-world">' + escapeHtml(r.world || "—") + '</td>'
      + '<td class="col-detail">' + escapeHtml(r.detail) + '</td>'
      + '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderVoteTable(rows, emptyText) {
  if (!rows.length) {
    return '<div class="feed-empty">' + escapeHtml(emptyText || "Нет данных") + '</div>';
  }
  let html = '<table class="feed-table"><thead><tr>';
  html += '<th class="col-time">Дата</th>';
  html += '<th class="col-player">Игрок</th>';
  html += '<th class="col-server">Сервер</th>';
  html += '<th class="col-source">Источник</th>';
  html += '<th class="col-question">Вопрос</th>';
  html += '<th class="col-detail">Ответ</th>';
  html += '</tr></thead><tbody>';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    html += '<tr>'
      + '<td class="col-time">' + escapeHtml(r.date) + '</td>'
      + '<td class="col-player">' + escapeHtml(r.player) + '</td>'
      + '<td class="col-server"><span class="server-badge">' + escapeHtml(r.server || "—") + '</span></td>'
      + '<td class="col-source"><span class="source-badge source-' + r.source + '">' + escapeHtml(r.source) + '</span></td>'
      + '<td class="col-question">' + escapeHtml(r.reason) + '</td>'
      + '<td class="col-detail">' + escapeHtml(r.detail) + '</td>'
      + '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderPagination(total, page, key) {
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (totalPages <= 1) return "";

  let btns = [];
  function addBtn(p, label, active, disabled) {
    btns.push('<button class="page-btn' + (active ? ' active' : '') + '" data-page="' + p + '" data-key="' + key + '"'
      + (disabled ? ' disabled' : '') + '>' + label + '</button>');
  }

  addBtn(page - 1, '‹', false, page <= 1);

  const range = [];
  function add(p) { if (p >= 1 && p <= totalPages && range.indexOf(p) === -1) range.push(p); }
  add(1);
  add(2);
  for (let i = page - 2; i <= page + 2; i++) add(i);
  add(totalPages - 1);
  add(totalPages);
  range.sort(function (a, b) { return a - b; });

  let prev = 0;
  for (let i = 0; i < range.length; i++) {
    const p = range[i];
    if (prev && p - prev > 1) btns.push('<span class="page-dots">…</span>');
    addBtn(p, String(p), p === page, false);
    prev = p;
  }

  addBtn(page + 1, '›', false, page >= totalPages);

  return '<div class="pagination">'
    + '<span class="page-info">стр. ' + page + ' из ' + totalPages + ' · всего ' + total + '</span>'
    + '<span class="page-btns">' + btns.join("") + '</span>'
    + '</div>';
}

function renderCurrent() {
  const feed = el("feed-body");
  const pag = el("feed-pagination");
  if (!feed) return;

  const data = normalizeAll();

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const all = data.grim.concat(data.vulcan, data.matrix, data.chat, data.commands, data.votes)
      .filter(function (r) { return r.player.toLowerCase().indexOf(q) !== -1; })
      .sort(sortByTs);

    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (!pages.search || pages.search < 1) pages.search = 1;
    if (pages.search > totalPages) pages.search = totalPages;
    const start = (pages.search - 1) * PER_PAGE;
    const pageRows = all.slice(start, start + PER_PAGE);

    el("feed-title").textContent = 'поиск "' + searchQuery + '" · ' + selectedDate
      + (selectedServer ? ' · ' + selectedServer : '') + ' · ' + total;
    feed.innerHTML = renderTable(pageRows, 'Ничего не найдено');
    if (pag) pag.innerHTML = renderPagination(total, pages.search, "search");
    return;
  }

  const isToday = (selectedDate === todayKey());
  const rows = (data[currentTab] || []).slice().sort(sortByTs);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  if (!pages[currentTab] || pages[currentTab] < 1) pages[currentTab] = 1;
  if (pages[currentTab] > totalPages) pages[currentTab] = totalPages;
  const start = (pages[currentTab] - 1) * PER_PAGE;
  const pageRows = rows.slice(start, start + PER_PAGE);

  el("feed-title").textContent = currentTab + " · " + selectedDate
    + (selectedServer ? " · " + selectedServer : "")
    + (isToday ? " · сегодня" : "");

  if (currentTab === "chat" || currentTab === "commands") {
    feed.innerHTML = renderChatTable(pageRows, currentTab === "chat" ? "Сообщений нет" : "Команд нет");
  } else if (currentTab === "votes") {
    feed.innerHTML = renderVoteTable(pageRows, "Голосов нет");
  } else {
    feed.innerHTML = renderTable(pageRows, "Записей " + currentTab + " нет");
  }

  if (pag) pag.innerHTML = renderPagination(total, pages[currentTab], currentTab);
}

function setOnline(online) {
  const pill = el("status-pill");
  if (!pill) return;
  pill.classList.toggle("pill-green", online);
  pill.classList.toggle("pill-red", !online);
  pill.innerHTML = online ? '<span class="dot"></span> ОНЛАЙН' : '<span class="dot"></span> НЕТ СВЯЗИ';
}

function getToken() {
  return localStorage.getItem("alogs_token") || "";
}

function setToken(t) {
  localStorage.setItem("alogs_token", t);
}

function clearToken() {
  localStorage.removeItem("alogs_token");
}

function showMain() {
  const gate = el("auth-gate");
  const main = el("main-wrap");
  if (gate) gate.classList.add("hidden");
  if (main) main.style.display = "";
}

function showGate() {
  const gate = el("auth-gate");
  const main = el("main-wrap");
  if (gate) gate.classList.remove("hidden");
  if (main) main.style.display = "none";
}

async function login(password) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 10000);
  try {
    const res = await fetch(API_BASE + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return { error: "Неверный пароль" };
    const data = await res.json();
    if (!data.token) return { error: "Сервер не вернул токен" };
    return { token: data.token };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") return { error: "Сервер не отвечает (>10 сек)" };
    return { error: "Сеть недоступна: " + (e.message || "ошибка") };
  }
}

async function initAuth() {
  const token = getToken();
  if (token) {
    try {
      const res = await fetch(API_BASE + "/servers", {
        headers: { "Authorization": "Bearer " + token },
        cache: "no-store"
      });
      if (res.ok) {
        serversList = await res.json();
        fillServerSelect();
        showMain();
        return true;
      }
    } catch (e) {}
    clearToken();
  }

  const gate = el("auth-gate");
  const input = el("auth-input");
  const btn = el("auth-btn");
  const err = el("auth-error");
  if (!gate || !input || !btn) return false;

  showGate();

  async function tryLogin() {
    const val = input.value;
    if (!val) return;
    if (err) err.textContent = "Проверка...";
    const result = await login(val);
    if (result.token) {
      setToken(result.token);
      if (err) err.textContent = "";
      await loadServers();
      showMain();
      bootData();
    } else {
      if (err) err.textContent = result.error || "Ошибка входа";
      input.value = "";
      input.focus();
    }
  }

  btn.addEventListener("click", tryLogin);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") tryLogin();
  });
  input.focus();

  return false;
}

/* ===== Серверы ===== */

function fillServerSelect() {
  const sel = el("server-select");
  if (!sel) return;

  sel.innerHTML = "";

  if (!serversList.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "— нет серверов —";
    sel.appendChild(opt);
    selectedServer = "";
    return;
  }

  serversList.forEach(function (s) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });

  if (selectedServer && serversList.indexOf(selectedServer) !== -1) {
    sel.value = selectedServer;
  } else {
    selectedServer = serversList[0];
    sel.value = selectedServer;
  }
}

async function loadServers() {
  const token = getToken();
  const res = await fetch(API_BASE + "/servers", {
    headers: { "Authorization": "Bearer " + token },
    cache: "no-store"
  });
  if (!res.ok) return;
  serversList = await res.json();
  fillServerSelect();
}

/* ===== Данные ===== */

async function loadAll() {
  const token = getToken();

  if (!serversList.length) {
    await loadServers();
  }

  if (!selectedServer) {
    cache = { grim: [], vulcan: [], matrix: [], chat: [], commands: [], votes: [] };
    return;
  }

  const res = await fetch(
    API_BASE + "/all?date=" + encodeURIComponent(selectedDate)
      + "&server=" + encodeURIComponent(selectedServer),
    {
      headers: { "Authorization": "Bearer " + token },
      cache: "no-store"
    }
  );

  if (res.status === 401) {
    clearToken();
    showGate();
    const err = el("auth-error");
    if (err) err.textContent = "Сессия истекла. Войдите заново.";
    throw new Error("Unauthorized");
  }

  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();

  cache.grim     = Array.isArray(data.grim)     ? data.grim     : [];
  cache.vulcan   = Array.isArray(data.vulcan)   ? data.vulcan   : [];
  cache.matrix   = Array.isArray(data.matrix)   ? data.matrix   : [];
  cache.chat     = Array.isArray(data.chat)     ? data.chat     : [];
  cache.commands = Array.isArray(data.commands) ? data.commands : [];
  cache.votes    = Array.isArray(data.votes)    ? data.votes    : [];

  const cg = el("count-grim");
  const cv = el("count-vulcan");
  const cm = el("count-matrix");
  const cc = el("count-chat");
  const cc2 = el("count-commands");
  const cv2 = el("count-votes");
  if (cg) cg.textContent = cache.grim.length;
  if (cv) cv.textContent = cache.vulcan.length;
  if (cm) cm.textContent = cache.matrix.length;
  if (cc) cc.textContent = cache.chat.length;
  if (cc2) cc2.textContent = cache.commands.length;
  if (cv2) cv2.textContent = cache.votes.length;
}

async function refresh() {
  try {
    await loadAll();
    renderCurrent();
    setOnline(true);
  } catch (err) {
    console.error("Refresh failed:", err);
    setOnline(false);
  }
}

/* ===== Обработчики ===== */

document.querySelectorAll(".tab").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".tab").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    currentTab = btn.dataset.tab;
    renderCurrent();
  });
});

document.addEventListener("click", function (e) {
  const btn = e.target.closest && e.target.closest(".page-btn");
  if (!btn || btn.disabled) return;
  const p = parseInt(btn.getAttribute("data-page"), 10);
  const key = btn.getAttribute("data-key") || currentTab;
  if (isNaN(p) || p < 1) return;
  pages[key] = p;
  renderCurrent();
  const feed = el("feed-body");
  if (feed) feed.scrollTop = 0;
});

const searchInput = el("search-input");
const searchClear = el("search-clear");

if (searchInput) {
  searchInput.addEventListener("input", function (e) {
    searchQuery = e.target.value.trim();
    pages.search = 1;
    if (searchClear) searchClear.classList.toggle("visible", searchQuery.length > 0);
    renderCurrent();
  });
}

if (searchClear) {
  searchClear.addEventListener("click", function () {
    searchInput.value = "";
    searchQuery = "";
    pages.search = 1;
    searchClear.classList.remove("visible");
    renderCurrent();
  });
}

const dateInput = el("date-input");
if (dateInput) {
  dateInput.value = selectedDate;
  dateInput.addEventListener("change", function (e) {
    if (!e.target.value) return;
    selectedDate = e.target.value;
    pages = { grim: 1, vulcan: 1, matrix: 1, chat: 1, commands: 1, votes: 1, search: 1 };
    refresh();
  });
}

const dateToday = el("date-today");
if (dateToday) {
  dateToday.addEventListener("click", function () {
    selectedDate = todayKey();
    if (dateInput) dateInput.value = selectedDate;
    pages = { grim: 1, vulcan: 1, matrix: 1, chat: 1, commands: 1, votes: 1, search: 1 };
    refresh();
  });
}

const serverSelect = el("server-select");
if (serverSelect) {
  serverSelect.addEventListener("change", function (e) {
    selectedServer = e.target.value;
    pages = { grim: 1, vulcan: 1, matrix: 1, chat: 1, commands: 1, votes: 1, search: 1 };
    refresh();
  });
}

/* ===== Старт ===== */

function bootData() {
  if (dataInterval) return;
  refresh();
  dataInterval = setInterval(refresh, REFRESH_MS);
}

initAuth().then(function (loggedIn) {
  if (loggedIn) bootData();
});
