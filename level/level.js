(function () {
    'use strict';

    const presetEl  = document.getElementById('blockPreset');
    const valueEl   = document.getElementById('blockValue');
    const stacksEl  = document.getElementById('stacks');

    const levelEl   = document.getElementById('resultLevel');
    const outBlocks = document.getElementById('outBlocks');
    const outScore  = document.getElementById('outScore');
    const outLevel  = document.getElementById('outLevel');

    const STACK_SIZE = 64;
    const DIVIDER    = 100;

    function fmt(n) {
        if (!isFinite(n)) return '0';
        return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
    }

    presetEl.addEventListener('change', function () {
        if (presetEl.value !== 'custom') {
            valueEl.value = presetEl.value;
        }
        calc();
    });

    valueEl.addEventListener('input', function () {
        const match = Array.from(presetEl.options)
            .find(o => o.value === valueEl.value);
        presetEl.value = match ? match.value : 'custom';
        calc();
    });

    stacksEl.addEventListener('input', calc);

    function calc() {
        const value  = parseFloat(valueEl.value)  || 0;
        const stacks = parseFloat(stacksEl.value) || 0;

        const blocks = stacks * STACK_SIZE;
        const score = blocks * value;
        const level = score / DIVIDER;

        levelEl.textContent   = fmt(level);
        outBlocks.textContent = fmt(blocks);
        outScore.textContent  = fmt(score);
        outLevel.textContent  = fmt(level);
    }

    calc();
})();
