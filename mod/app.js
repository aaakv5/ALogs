const API_BASE = "https://logs.arcanomc.pw";
const REFRESH_MS = 5000;
const PER_PAGE = 100;

let currentTab = "grim";
let cache = { grim: [], vulcan: [], matrix: [], server: "—" };
let searchQuery = "";
let selectedDate = todayKey();
let pages = { grim: 1, vulcan: 1, matrix: 1 };

function el(id) { return document.getElementById(id); }
function pad2(n) { return n < 10 ? "0" + n : "" + n; }

function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
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
  const d = new Date(typeof ts === "number" ? ts : Date.parse(ts));
  if (isNaN(d.getTime())) return String(ts);
  return pad2(d.getDate()) + "." + pad2(d.getMonth() + 1) + "." + d.getFullYear()
    + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
}

function vlClass(vl) {
  const v = Number(vl) || 0;
  if (v >= 10) return "high";
  if (v >= 3) return "";
  return "low";
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
    server: cache.server,
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

  const parsed = Date.parse(dt.replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1"));

  return {
    date: dt || "—",
    player: String(r.player || "—"),
    reason: reason,
    detail: parts.join(" • "),
    vl: r.vl != null ? r.vl : 0,
    ping: r.ping != null ? r.ping : "—",
    source: "vulcan",
    server: cache.server,
    _ts: isNaN(parsed) ? 0 : parsed
  };
}

function normalizeMatrix(r) {
  const raw = r.time || "";
  const parsed = Date.parse(raw.replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1"));

  return {
    date: raw || "—",
    player: String(r.player || "—"),
    reason: String(r.category || "—"),
    detail: r.detail ? (r.detail + " [" + (r.component || "") + "]") : "—",
    vl: r.vl != null ? r.vl : 0,
    ping: r.ping != null ? r.ping : "—",
    source: "matrix",
    server: cache.server,
    _ts: isNaN(parsed) ? 0 : parsed
  };
}

function normalizeAll() {
  return {
    grim:   (cache.grim   || []).map(normalizeGrim),
    vulcan: (cache.vulcan || []).map(normalizeVulcan),
    matrix: (cache.matrix || []).map(normalizeMatrix)
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

function renderPagination(total, page) {
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (totalPages <= 1) return "";

  let btns = [];
  function addBtn(p, label, active, disabled) {
    btns.push('<button class="page-btn' + (active ? ' active' : '') + '" data-page="' + p + '"'
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
  if (!feed) return;

  const data = normalizeAll();
  const isToday = (selectedDate === todayKey());

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const all = data.grim.concat(data.vulcan, data.matrix)
      .filter(function (r) { return r.player.toLowerCase().indexOf(q) !== -1; })
      .sort(sortByTs);
    el("feed-title").textContent = 'поиск "' + searchQuery + '" · ' + selectedDate + ' · ' + all.length;
    feed.innerHTML = renderTable(all, 'Ничего не найдено');
    return;
  }

  const rows = (data[currentTab] || []).slice().sort(sortByTs);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  if (!pages[currentTab] || pages[currentTab] < 1) pages[currentTab] = 1;
  if (pages[currentTab] > totalPages) pages[currentTab] = totalPages;

  const start = (pages[currentTab] - 1) * PER_PAGE;
  const pageRows = rows.slice(start, start + PER_PAGE);

  el("feed-title").textContent = currentTab + " · " + selectedDate + (isToday ? " · сегодня" : "");
  feed.innerHTML = renderTable(pageRows, "Записей " + currentTab + " нет") + renderPagination(total, pages[currentTab]);
}

function setOnline(online) {
  const pill = el("status-pill");
  if (!pill) return;
  pill.classList.toggle("pill-green", online);
  pill.classList.toggle("pill-red", !online);
  pill.innerHTML = online ? '<span class="dot"></span> ОНЛАЙН' : '<span class="dot"></span> НЕТ СВЯЗИ';
}

async function loadAll() {
  const res = await fetch(API_BASE + "/all?date=" + encodeURIComponent(selectedDate), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();

  cache.grim   = Array.isArray(data.grim)   ? data.grim   : [];
  cache.vulcan = Array.isArray(data.vulcan) ? data.vulcan : [];
  cache.matrix = Array.isArray(data.matrix) ? data.matrix : [];
  cache.server = data.server || "—";

  const cg = el("count-grim");
  const cv = el("count-vulcan");
  const cm = el("count-matrix");
  if (cg) cg.textContent = cache.grim.length;
  if (cv) cv.textContent = cache.vulcan.length;
  if (cm) cm.textContent = cache.matrix.length;
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
  if (isNaN(p) || p < 1) return;
  pages[currentTab] = p;
  renderCurrent();
  const feed = el("feed-body");
  if (feed) feed.scrollTop = 0;
});

const searchInput = el("search-input");
const searchClear = el("search-clear");

if (searchInput) {
  searchInput.addEventListener("input", function (e) {
    searchQuery = e.target.value.trim();
    if (searchClear) searchClear.classList.toggle("visible", searchQuery.length > 0);
    renderCurrent();
  });
}

if (searchClear) {
  searchClear.addEventListener("click", function () {
    searchInput.value = "";
    searchQuery = "";
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
    pages = { grim: 1, vulcan: 1, matrix: 1 };
    refresh();
  });
}

const dateToday = el("date-today");
if (dateToday) {
  dateToday.addEventListener("click", function () {
    selectedDate = todayKey();
    if (dateInput) dateInput.value = selectedDate;
    pages = { grim: 1, vulcan: 1, matrix: 1 };
    refresh();
  });
}

refresh();
setInterval(refresh, REFRESH_MS);
