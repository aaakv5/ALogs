const API_BASE = "https://logs.arcanomc.pw";
const REFRESH_MS = 5000;

let currentTab = "grim";
let cache = { grim: [], vulcan: [], matrix: [] };
let searchQuery = "";
let selectedDate = todayKey();

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

  const vl = r.vl != null ? r.vl : (r.violations != null ? r.violations : 0);
  const ping = r.ping != null ? r.ping : "—";

  return {
    date: typeof time === "number" ? fmtFull(time) : (time ? String(time) : "—"),
    player: String(player),
    reason: String(reason),
    detail: parts.join(" • "),
    vl: vl,
    ping: ping,
    source: "grim",
    _ts: typeof time === "number" ? time : 0
  };
}

function normalizeVulcan(r) {
  const dt = (r.date || "—") + " " + (r.time || "");
  const pos = (r.x && r.y && r.z)
    ? "X: " + (+r.x).toFixed(1) + ", Y: " + (+r.y).toFixed(1) + ", Z: " + (+r.z).toFixed(1)
    : "";
  const detail = [pos, r.version ? "v" + r.version : ""].filter(Boolean).join(" • ");

  const parsed = Date.parse(
    dt.trim().replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1")
  );

  return {
    date: dt.trim() || "—",
    player: String(r.player || "—"),
    reason: String(r.reason || "—"),
    detail: detail,
    vl: r.violations != null ? r.violations : 0,
    ping: r.ping != null ? r.ping : "—",
    source: "vulcan",
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

  return '<table class="feed-table">'
    + '<thead><tr>'
    + '<th class="col-time">Дата</th>'
    + '<th class="col-player">Игрок</th>'
    + '<th class="col-source">Источник</th>'
    + '<th class="col-type">Причина</th>'
    + '<th class="col-detail">Детали</th>'
    + '<th class="col-vl">VL</th>'
    + '<th class="col-ping">Пинг</th>'
    + '</tr></thead>'
    + '<tbody>'
    + rows.map(function (r) {
        return '<tr>'
          + '<td class="col-time">' + escapeHtml(r.date) + '</td>'
          + '<td class="col-player">' + escapeHtml(r.player) + '</td>'
          + '<td class="col-source"><span class="source-badge source-' + r.source + '">' + escapeHtml(r.source) + '</span></td>'
          + '<td class="col-type">' + escapeHtml(r.reason) + '</td>'
          + '<td class="col-detail">' + escapeHtml(r.detail) + '</td>'
          + '<td class="col-vl"><span class="vl-badge ' + vlClass(r.vl) + '">' + escapeHtml(r.vl) + '</span></td>'
          + '<td class="col-ping">' + escapeHtml(r.ping) + '</td>'
          + '</tr>';
      }).join("")
    + '</tbody></table>';
}

function renderCurrent() {
  const feed = el("feed-body");
  const data = normalizeAll();
  const isToday = (selectedDate === todayKey());

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const all = data.grim.concat(data.vulcan, data.matrix)
      .filter(function (r) { return r.player.toLowerCase().indexOf(q) !== -1; })
      .sort(sortByTs);

    el("feed-title").textContent = 'поиск "' + searchQuery + '" · ' + selectedDate + ' · ' + all.length + ' записей';
    feed.innerHTML = renderTable(all, 'Ничего не найдено');
    return;
  }

  const rows = (data[currentTab] || []).sort(sortByTs);
  el("feed-title").textContent = currentTab + " · " + selectedDate + (isToday ? " · сегодня" : "");
  feed.innerHTML = renderTable(rows, "Записей " + currentTab + " нет");
}

function setOnline(online) {
  const pill = el("status-pill");
  if (!pill) return;
  pill.classList.toggle("pill-green", online);
  pill.classList.toggle("pill-red", !online);
  pill.innerHTML = online
    ? '<span class="dot"></span> ОНЛАЙН'
    : '<span class="dot"></span> НЕТ СВЯЗИ';
}

async function loadAll() {
  const res = await fetch(API_BASE + "/all?date=" + encodeURIComponent(selectedDate), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();

  cache.grim   = Array.isArray(data.grim)   ? data.grim   : [];
  cache.vulcan = Array.isArray(data.vulcan) ? data.vulcan : [];
  cache.matrix = Array.isArray(data.matrix) ? data.matrix : [];

  el("count-grim").textContent   = cache.grim.length;
  el("count-vulcan").textContent = cache.vulcan.length;
  el("count-matrix").textContent = cache.matrix.length;
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

const searchInput = el("search-input");
const searchClear = el("search-clear");

searchInput.addEventListener("input", function (e) {
  searchQuery = e.target.value.trim();
  searchClear.classList.toggle("visible", searchQuery.length > 0);
  renderCurrent();
});

searchClear.addEventListener("click", function () {
  searchInput.value = "";
  searchQuery = "";
  searchClear.classList.remove("visible");
  renderCurrent();
});

const dateInput = el("date-input");
dateInput.value = selectedDate;

dateInput.addEventListener("change", function (e) {
  if (!e.target.value) return;
  selectedDate = e.target.value;
  refresh();
});

el("date-today").addEventListener("click", function () {
  selectedDate = todayKey();
  dateInput.value = selectedDate;
  refresh();
});

refresh();
setInterval(refresh, REFRESH_MS);
