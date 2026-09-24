(function () {
    'use strict';

    const API_BASE = 'https://logs.arcanomc.pw';

    const cache = {
        sections: null,
        servers: null,
        rules: {}
    };

    let currentSection = 'global';
    let currentServer = 'all';
    let initialized = false;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function init() {
        if (initialized) return;
        initialized = true;

        const panel = document.getElementById('rules-panel');
        const toggleBtn = document.getElementById('rules-toggle');
        const closeBtn = document.getElementById('rules-close');
        const serverSelect = document.getElementById('rules-server');
        const tabsContainer = document.getElementById('rules-tabs');
        const content = document.getElementById('rules-content');

        if (!panel || !toggleBtn) return;

        function openPanel() {
            panel.classList.add('open');
            toggleBtn.classList.add('hidden');
            document.body.classList.add('rules-open');
            loadInitialData();
        }

        function closePanel() {
            panel.classList.remove('open');
            toggleBtn.classList.remove('hidden');
            document.body.classList.remove('rules-open');
        }

        toggleBtn.addEventListener('click', openPanel);
        closeBtn.addEventListener('click', closePanel);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closePanel();
        });

        async function loadInitialData() {
            if (cache.sections && cache.servers) {
                renderTabs(tabsContainer);
                renderServerSelect(serverSelect);
                loadRules(content);
                return;
            }
            try {
                content.innerHTML = '<div class="rules-loading">Загрузка...</div>';
                const res = await fetch(API_BASE + '/rules', {
                    headers: { "Authorization": "Bearer " + (localStorage.getItem("alogs_token") || "") }
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();

                cache.sections = data.items || [];
                cache.servers = data.servers || [];

                renderTabs(tabsContainer);
                renderServerSelect(serverSelect);
                loadRules(content);
            } catch (err) {
                content.innerHTML = '<div class="rules-empty">Не удалось загрузить правила: ' + escapeHtml(err.message) + '</div>';
            }
        }

        function renderTabs(container) {
            container.innerHTML = (cache.sections || []).map(function (s) {
                return '<button class="rules-tab ' + (s.id === currentSection ? 'active' : '') + '" data-section="' + escapeHtml(s.id) + '">' +
                    escapeHtml(s.label) +
                    '</button>';
            }).join('');

            container.querySelectorAll('.rules-tab').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    currentSection = btn.dataset.section;
                    renderTabs(container);
                    loadRules(content);
                });
            });
        }

        function renderServerSelect(select) {
            select.innerHTML = (cache.servers || []).map(function (s) {
                return '<option value="' + escapeHtml(s.id) + '"' + (s.id === currentServer ? ' selected' : '') + '>' +
                    escapeHtml(s.label) +
                    '</option>';
            }).join('');

            select.addEventListener('change', function () {
                currentServer = select.value;
                loadRules(content);
            });
        }

        async function loadRules(container) {
            const key = currentSection + ':' + currentServer;
            if (cache.rules[key]) {
                renderRules(container, cache.rules[key]);
                return;
            }

            container.innerHTML = '<div class="rules-loading">Загрузка...</div>';
            try {
                const res = await fetch(
                    API_BASE + '/rules/' + encodeURIComponent(currentSection) +
                    '?server=' + encodeURIComponent(currentServer),
                    { headers: { "Authorization": "Bearer " + (localStorage.getItem("alogs_token") || "") } }
                );
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();

                cache.rules[key] = data;
                renderRules(container, data);
            } catch (err) {
                container.innerHTML = '<div class="rules-empty">Ошибка загрузки: ' + escapeHtml(err.message) + '</div>';
            }
        }

        function renderRules(container, data) {
            const items = data.items || [];
            if (!items.length) {
                container.innerHTML = '<div class="rules-empty">В этом разделе пока нет правил.</div>';
                return;
            }

            const title = data.title ? '<div class="rules-section-title">' + escapeHtml(data.title) + '</div>' : '';

            container.innerHTML = title + items.map(function (item, idx) {
                const number = item.number || String(idx + 1);
                const text = item.text || '';
                const punish = item.punish
                    ? '<div class="rules-punish">» Наказание: ' + escapeHtml(item.punish) + '</div>'
                    : '';
                return '<div class="rules-item">' +
                    '<span class="rules-number">[' + escapeHtml(number) + ']</span>' +
                    '<span class="rules-text">' + escapeHtml(text) + '</span>' +
                    punish +
                    '</div>';
            }).join('');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
