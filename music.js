(function () {
    'use strict';

    function escapeHtml(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderTracks(tracks) {
        const container = document.getElementById('tracks');
        if (!container) return;
        if (!tracks || !tracks.length) {
            container.innerHTML = '<div class="loading">Треков нет</div>';
            return;
        }
        container.innerHTML = tracks.map(function (t) {
            const url = t.id ? 'https://music.yandex.ru/track/' + t.id : '#';
            return '<a class="track" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' +
                (t.cover ? '<img class="track-cover" src="' + escapeHtml(t.cover) + '" alt="" loading="lazy">' : '<div class="track-cover"></div>') +
                '<div class="track-info">' +
                    '<div class="track-title">' + escapeHtml(t.title) + '</div>' +
                    '<div class="track-artist">' + escapeHtml((t.artists || []).join(', ')) + '</div>' +
                '</div>' +
                '<span class="track-play">' +
                    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">' +
                        '<path d="M8 5v14l11-7z"/>' +
                    '</svg>' +
                '</span>' +
                '<div class="track-duration">' + escapeHtml(t.duration) + '</div>' +
            '</a>';
        }).join('');
    }

    function renderAlbums(albums) {
        const container = document.getElementById('albums');
        if (!container) return;
        if (!albums || !albums.length) {
            container.innerHTML = '<div class="loading">Альбомов нет</div>';
            return;
        }
        container.innerHTML = albums.map(function (a) {
            const url = a.id ? 'https://music.yandex.ru/album/' + a.id : '#';
            return '<a class="album" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' +
                (a.cover ? '<img class="album-cover" src="' + escapeHtml(a.cover) + '" alt="" loading="lazy">' : '<div class="album-cover"></div>') +
                '<div class="album-title">' + escapeHtml(a.title) + '</div>' +
                '<div class="album-year">' + escapeHtml(a.year) + '</div>' +
            '</a>';
        }).join('');
    }

    function renderProfile(data) {
        const avatarEl = document.getElementById('artist-avatar');
        const nameEl = document.getElementById('artist-name');
        const listenersEl = document.getElementById('artist-listeners');

        if (avatarEl && data.avatar) avatarEl.src = data.avatar;
        if (nameEl) nameEl.textContent = data.name || 'akv5';
        if (listenersEl) {
            const n = data.listeners || 0;
            listenersEl.textContent = n.toLocaleString('ru-RU') + ' слушателей в месяц';
        }
    }

    async function loadData() {
        try {
            const res = await fetch('music-data.json?t=' + Date.now());
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();

            renderProfile(data);
            renderTracks(data.tracks);
            renderAlbums(data.albums);
        } catch (err) {
            console.error('Ошибка загрузки данных:', err);
            const t = document.getElementById('tracks');
            if (t) t.innerHTML = '<div class="loading">Не удалось загрузить данные</div>';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadData);
    } else {
        loadData();
    }
})();
