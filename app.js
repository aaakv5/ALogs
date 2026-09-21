const API_BASE = "https://react.arcanomc.pw";
const REFRESH_MS = 5000;

function el(id) { return document.getElementById(id); }

function formatPercent(v) {
  return (v * 100).toFixed(1) + "%";
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("ru-RU", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function badgeFor(prob) {
  if (prob > 0.7) return { cls: "badge-cheat", label: "CHEAT" };
  if (prob > 0.4) return { cls: "badge-warn",  label: "WARN"  };
  return { cls: "badge-clean", label: "CLEAN" };
}

async function loadDetections() {
  const res = await fetch(`${API_BASE}/detections`, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();

  const feed = el("feed-body");
  if (!feed) return;

  if (!data.length) {
    feed.innerHTML = '<div class="feed-empty">Ожидание данных...</div>';
    return;
  }

  feed.innerHTML = data.map(d => {
    const b = badgeFor(d.probability);
    return `
      <div class="feed-row">
        <div class="feed-time">${formatTime(d.timestamp)}</div>
        <div class="feed-src">DEEPSEEK</div>
        <div class="feed-player">${escapeHtml(d.player)}</div>
        <div class="feed-prob">prob <b>${formatPercent(d.probability)}</b></div>
        <div class="feed-conf">conf <b>${formatPercent(d.confidence)}</b></div>
        <div class="feed-badge ${b.cls}">${b.label}</div>
      </div>
    `;
  }).join("");
}

function setOnline(online) {
  const pill = document.querySelector(".pill.pill-green");
  if (!pill) return;
  if (online) {
    pill.classList.add("pill-green");
    pill.innerHTML = '<span class="dot"></span> ОНЛАЙН';
  } else {
    pill.classList.remove("pill-green");
    pill.innerHTML = '<span class="dot"></span> НЕТ СВЯЗИ';
  }
}

async function refresh() {
  try {
    await loadDetections();
    setOnline(true);
  } catch (err) {
    console.error(err);
    setOnline(false);
  }
}

refresh();
setInterval(refresh, REFRESH_MS);
