const API_BASE = "https://react.arcanomc.pw";

const REFRESH_MS = 5000;

function el(id) {
    return document.getElementById(id);
}

function riskClass(prob) {
    if (prob > 0.7) return "danger";
    if (prob > 0.4) return "warn";
    return "safe";
}

function formatPercent(value) {
    return (value * 100).toFixed(1) + "%";
}

function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/* ---------- Статус сервера ---------- */

function setStatus(online) {
    const dot = el("status-dot");
    const text = el("status-text");

    if (online) {
        dot.classList.remove("offline");
        dot.classList.add("online");
        text.textContent = "Сервер онлайн";
    } else {
        dot.classList.remove("online");
        dot.classList.add("offline");
        text.textContent = "Нет связи";
    }
}

async function loadPlayers() {
    try {
        const res = await fetch(`${API_BASE}/players`, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();

        const list = el("players-list");
        el("players-count").textContent = data.length;
        el("stat-online").textContent = data.length;

        if (data.length === 0) {
            list.innerHTML = '<li class="empty">Нет игроков онлайн</li>';
            return;
        }

        list.innerHTML = data.map(p => `
            <li>
                <span class="player-status"></span>
                <span class="player-name">${escapeHtml(p.name)}</span>
                <span class="player-meta">
                    <span>${escapeHtml(p.world ?? "—")}</span>
                    <span>${p.ping ?? "?"} ms</span>
                </span>
            </li>
        `).join("");
    } catch (err) {
        console.error("players:", err);
        setStatus(false);
        throw err;
    }
}

async function loadDetections() {
  try {
    const res = await fetch(`${API_BASE}/detections`, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    const feed = el("feed-body");
    el("detections-count") && (el("detections-count").textContent = data.length);

    if (data.length === 0) {
      feed.innerHTML = '<div class="feed-empty">Ожидание данных...</div>';
      return;
    }

    feed.innerHTML = data.map(d => {
      const cls = d.probability > 0.7 ? "badge-cheat"
                : d.probability > 0.4 ? "badge-warn"
                : "badge-clean";
      const label = d.probability > 0.7 ? "CHEAT"
                  : d.probability > 0.4 ? "WARN"
                  : "CLEAN";
      return `
        <div class="feed-row">
          <div class="feed-time">${formatTime(d.timestamp)}</div>
          <div class="feed-src">DEEPSEEK</div>
          <div class="feed-player">${escapeHtml(d.player)}</div>
          <div class="feed-prob">prob <b>${formatPercent(d.probability)}</b></div>
          <div class="feed-conf">conf <b>${formatPercent(d.confidence)}</b></div>
          <div class="feed-badge ${cls}">${label}</div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("detections:", err);
    setStatus(false);
    throw err;
  }
}

async function refresh() {
  try {
    await loadDetections();
    setStatus(true);
  } catch (_) {
    setStatus(false);
  }
}

refresh();
setInterval(refresh, REFRESH_MS);
