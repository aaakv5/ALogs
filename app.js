const API_BASE = "http://akv5.fun:30005/anticheat";

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

        const tbody = el("detections-list");
        el("detections-count").textContent = data.length;
        el("stat-detections").textContent = data.length;

        if (data.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Детектов пока нет</td></tr>';
            el("stat-risk").textContent = "—";
            return;
        }

        let sum = 0;
        data.forEach(d => sum += d.probability);
        const avg = sum / data.length;
        el("stat-risk").textContent = formatPercent(avg);

        tbody.innerHTML = data.map(d => {
            const cls = riskClass(d.probability);
            return `
                <tr>
                    <td class="player">${escapeHtml(d.player)}</td>
                    <td class="${cls}">${formatPercent(d.probability)}</td>
                    <td>${formatPercent(d.confidence)}</td>
                    <td class="time">${formatTime(d.timestamp)}</td>
                </tr>
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
        await Promise.all([loadPlayers(), loadDetections()]);
        setStatus(true);
        el("stat-updated").textContent = new Date().toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    } catch (_) {
        setStatus(false);
    }
}

refresh();
setInterval(refresh, REFRESH_MS);
