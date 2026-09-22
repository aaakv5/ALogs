const API_BASE = "https://logs.arcanomc.pw";
const REFRESH_MS = 5000;

let currentTab = "grim";
let cache = { grim: [], vulcan: [], matrix: [] };
let searchQuery = "";

function el(id) { return document.getElementById(id); }

function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- Формат даты ---------- */

function fmtDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function vlClass(vl) {
  const v = Number(vl) || 0;
  if (v >= 10) return "high";
  if (v >= 3) return "";
  return "low";
}

/* ---------- Нормализация в единый вид ---------- */
/* { date, player, reason, detail, vl, ping, source } */

function normalizeGrim(r) {
  const time = r.created_at || r.time || r.timestamp || r.date || r.inserted_at;
  const player = r.player || r.player_name || r.username || r.uuid || "—";
  const reason = r.check_name || r.check || r.type || r.stable_key || "—";
  const detail = r.description || r.detail || r.info || r.verbose || "";
  const vl = r.vl ?? r.violations ?? r.level ?? 0;
  const ping = r.ping ?? r.keepalive ?? r.keep_alive_ping ?? "—";

  return {
    date: typeof time === "number" ? fmtDateTime(time) : (time ? String(time) : "—"),
    player: String(player),
    reason: String(reason),
    detail: String(detail),
    vl: vl,
    ping: ping,
    source: "grim"
  };
}

function normalizeVulcan(r) {
  const dt = r.date && r.time ? `${r.date} ${r.time}` : (r.date || r.time || "—");
  const pos = (r.x && r.y && r.z)
    ? `X: ${(+r.x).toFixed(1)}, Y: ${(+r.y).toFixed(1)}, Z: ${(+r.z).toFixed(1)}`
    : "";
  const detail = [pos, r.version ? "v" + r.version : ""].filter(Boolean).join(" • ");

  return {
    date: dt,
    player: String(r.player || "—"),
    reason: String(r.reason || "—"),
    detail: detail,
    vl: r.violations ?? 0,
    ping: r.ping ?? "—",
    source: "vulcan"
  };
}

function normalizeMatrix(r) {
  return {
    date: r.time || "—",
    player: String(r.player || "—"),
    reason: String(r.category || "—"),
    detail: r.detail ? `${r.detail} [${r.component || ""}]` : "—",
    vl: r.vl ?? 0,
    ping: r.ping ?? "—",
    source: "matrix"
  };
}

function normalizeAll() {
  return {
    grim: (cache.grim || []).map(normalizeGrim),
    vulcan: (cache.vulcan || []).map(normalizeVulcan),
    matrix: (cache.matrix || []).map(normalizeMatrix)
  };
}

/* ---------- Рендер таблицы ---------- */

function renderTable(rows, opts) {
  opts = opts || {};
  const showSource = !!opts.showSource;

  if (!rows.length) {
    return '<div class="feed-empty">' + escapeHtml(opts.emptyText || "Нет данных") + '</div>';
  }

  return `
    <table class="feed-table">
      <thead>
        <tr>
          <th class="col-time">Дата</th>
          <th class="col-player">Игрок</th>
          ${showSource ? '<th class="col-source">Источник</th>' : ''}
          <th class="col-type">Причина</th>
          <th class="col-detail">Детали</th>
          <th class="col-vl">VL</th>
          <th class="col-ping">Пинг</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(function (r) {
          return `
            <tr>
              <td class="col-time">${escapeHtml(r.date)}</td>
              <td class="col-player">${escapeHtml(r.player)}</td>
              ${showSource ? '<td class="col-source"><span class="source-badge source-' + r.source + '">' + escapeHtml(r.source) + '</span></td>' : ''}
              <td class="col-type">${escapeHtml(r.reason)}</td>
              <td class="col-detail">${escapeHtml(r.detail)}</td>
              <td class="col-vl"><span class="vl-badge ${vlClass(r.vl)}">${escapeHtml(r.vl)}</span></td>
              <td class="col-ping">${escapeHtml(r.ping)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>`;
}

function renderCurrent() {
  const feed = el("feed-body");
  const data = normalizeAll();

  /* --- Режим поиска --- */
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const all = data.grim.concat(data.vulcan, data.matrix)
      .filter(function (r) { return r.player.toLowerCase().indexOf(q) !== -1; });

    el("feed-title").textContent = 'поиск: "' + searchQuery + '" (' + all.length + ')';
    feed.innerHTML = renderTable(all, {
      showSource: true,
      emptyText: 'Ничего не найдено по запросу "' + searchQuery + '"'
    });
    return;
  }

  /* --- Режим вкладок --- */
  const rows = data[currentTab] || [];
  el("feed-title").textContent = currentTab;
  feed.innerHTML = renderTable(rows, {
    showSource: false,
    emptyText: "Записей " + currentTab + " нет"
  });
}

/* ---------- Онлайн-статус ---------- */

function setOnline(online) {
  const pill = el("status-pill");
  if (!pill) return;
  pill.classList.toggle("pill-green", online);
  pill.classList.toggle("pill-red", !online);
  pill.innerHTML = online
    ? '<span class="dot"></span> ОНЛАЙН'
    : '<span class="dot"></span> НЕТ СВЯЗИ';
}

/* ---------- Загрузка ---------- */

async function loadAll() {
  const res = await fetch(API_BASE + "/all", { cache: "no-store" });
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

/* ---------- Табы ---------- */

document.querySelectorAll(".tab").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".tab").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    currentTab = btn.dataset.tab;

    if (searchQuery) {
      searchQuery = "";
      el("search-input").value = "";
      el("search-clear").classList.remove("visible");
    }
    renderCurrent();
  });
});

/* ---------- Поиск ---------- */

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

/* ---------- Старт ---------- */

refresh();
setInterval(refresh, REFRESH_MS);
