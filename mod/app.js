const API_BASE = "https://logs.arcanomc.pw";
const REFRESH_MS = 5000;

let currentTab = "grim";
let cache = { grim: [], vulcan: [], matrix: [] };

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

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function fmtTimeStr(s) {
  return s || "—";
}

function vlClass(vl) {
  const v = Number(vl) || 0;
  if (v >= 10) return "high";
  if (v >= 3) return "";
  return "low";
}

function renderGrim(rows) {
  if (!rows || !rows.length) return emptyRow("Логов пока нет");

  return `
    <table class="feed-table">
      <thead>
        <tr>
          <th class="col-time">Время</th>
          <th class="col-player">Игрок</th>
          <th class="col-type">Проверка</th>
          <th class="col-detail">Детали</th>
          <th class="col-vl">VL</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const time = r.created_at || r.time || r.timestamp || r.date;
          const player = r.player || r.player_name || r.username || r.uuid || "—";
          const check = r.check_name || r.check || r.type || r.stable_key || "—";
          const detail = r.description || r.detail || r.info || "";
          const vl = r.vl ?? r.violations ?? 0;
          return `
            <tr>
              <td class="col-time">${escapeHtml(fmtDate(typeof time === "number" ? time : Date.parse(time)))}</td>
              <td class="col-player">${escapeHtml(player)}</td>
              <td class="col-type">${escapeHtml(check)}</td>
              <td class="col-detail">${escapeHtml(detail)}</td>
              <td class="col-vl"><span class="vl-badge ${vlClass(vl)}">${escapeHtml(vl)}</span></td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

function renderVulcan(rows) {
  if (!rows || !rows.length) return emptyRow("Логов пока нет");

  return `
    <table class="feed-table">
      <thead>
        <tr>
          <th class="col-time">Дата</th>
          <th class="col-player">Игрок</th>
          <th class="col-type">Причина</th>
          <th class="col-detail">Детали</th>
          <th class="col-world">Мир</th>
          <th class="col-ping">Пинг</th>
          <th class="col-vl">VL</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const dt = r.date && r.time ? `${r.date} ${r.time}` : (r.date || r.time || "—");
          const pos = (r.x && r.y && r.z)
            ? `X: ${(+r.x).toFixed(1)}, Y: ${(+r.y).toFixed(1)}, Z: ${(+r.z).toFixed(1)}`
            : "";
          const detail = [pos, r.version ? "v" + r.version : ""].filter(Boolean).join(" • ");
          return `
            <tr>
              <td class="col-time">${escapeHtml(dt)}</td>
              <td class="col-player">${escapeHtml(r.player)}</td>
              <td class="col-type">${escapeHtml(r.reason)}</td>
              <td class="col-detail">${escapeHtml(detail)}</td>
              <td class="col-world">${escapeHtml(r.world)}</td>
              <td class="col-ping">${escapeHtml(r.ping)}</td>
              <td class="col-vl"><span class="vl-badge ${vlClass(r.violations)}">${escapeHtml(r.violations || 0)}</span></td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

function renderMatrix(rows) {
  if (!rows || !rows.length) return emptyRow("Логов пока нет");

  return `
    <table class="feed-table">
      <thead>
        <tr>
          <th class="col-time">Время</th>
          <th class="col-player">Игрок</th>
          <th class="col-type">Проверка</th>
          <th class="col-detail">Детали</th>
          <th class="col-vl">VL</th>
          <th class="col-ping">Пинг</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td class="col-time">${escapeHtml(fmtTimeStr(r.time))}</td>
            <td class="col-player">${escapeHtml(r.player)}</td>
            <td class="col-type">${escapeHtml(r.category)}</td>
            <td class="col-detail">${escapeHtml(r.detail)} <span style="color:var(--text-dim)">[${escapeHtml(r.component)}]</span></td>
            <td class="col-vl"><span class="vl-badge ${vlClass(r.vl)}">${escapeHtml(r.vl)}</span></td>
            <td class="col-ping">${escapeHtml(r.ping)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function emptyRow(text) {
  return `<div class="feed-empty">${escapeHtml(text)}</div>`;
}

function renderCurrent() {
  const feed = el("feed-body");
  const data = cache[currentTab] || [];

  if (currentTab === "grim")   feed.innerHTML = renderGrim(data);
  if (currentTab === "vulcan") feed.innerHTML = renderVulcan(data);
  if (currentTab === "matrix") feed.innerHTML = renderMatrix(data);

  el("feed-title").textContent = currentTab;
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
  const res = await fetch(`${API_BASE}/all`, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();

  cache.grim   = Array.isArray(data.grim)   ? data.grim   : [];
  cache.vulcan = Array.isArray(data.vulcan) ? data.vulcan : [];
  cache.matrix = Array.isArray(data.matrix) ? data.matrix : [];

  if (data.grim && data.grim.error)   console.warn("Grim error:",   data.grim.error);
  if (data.vulcan && data.vulcan.error) console.warn("Vulcan error:", data.vulcan.error);
  if (data.matrix && data.matrix.error) console.warn("Matrix error:", data.matrix.error);
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

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentTab = btn.dataset.tab;
    renderCurrent();
  });
});

refresh();
setInterval(refresh, REFRESH_MS);
