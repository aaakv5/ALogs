(function () {
    'use strict';

    const presetEl  = document.getElementById('blockPreset');
    const valueEl   = document.getElementById('blockValue');
    const stacksEl  = document.getElementById('stacks');
    const costEl    = document.getElementById('levelCost');

    const levelEl   = document.getElementById('resultLevel');
    const outBlocks = document.getElementById('outBlocks');
    const outScore  = document.getElementById('outScore');
    const outLevel  = document.getElementById('outLevel');

    const STACK_SIZE = 64;

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
    costEl.addEventListener('input', calc);

    function calc() {
        const value    = parseFloat(valueEl.value) || 0;
        const stacks   = parseFloat(stacksEl.value) || 0;
        const levelCost = parseFloat(costEl.value) || 100;

        const totalItems = stacks * STACK_SIZE;
        const blocks     = totalItems * value;
        const level = levelCost > 0 ? blocks / levelCost : 0;

        levelEl.textContent   = fmt(Math.floor(level));
        outBlocks.textContent = fmt(totalItems);
        outScore.textContent  = fmt(blocks);
        outLevel.textContent  = fmt(level);
    }

    calc();
})();
