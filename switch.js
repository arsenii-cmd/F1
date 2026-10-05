// Переключатель вариантов сайта: «Старый» и «Claude» живут на главной странице, «Codex» — в папке codex/.
// Выбор хранится на устройстве (localStorage, ключ f1_variant).
(function () {
    var root = document.documentElement;
    var onCodexPage = root.dataset.page === 'codex';
    var home = onCodexPage ? '../' : './';

    function remember(variant) {
        try { localStorage.setItem('f1_variant', variant); } catch (_) {}
    }

    function choose(variant) {
        if (variant === root.dataset.variant) return;
        remember(variant);
        if (variant === 'codex' && !onCodexPage) { window.location.href = 'codex/'; return; }
        if (variant !== 'codex' && onCodexPage) { window.location.href = home; return; }
        // Старый ↔ Claude переключаются без перезагрузки (claude.js)
        if (typeof window.F1SetDesign === 'function') window.F1SetDesign(variant);
    }

    function sync() {
        document.querySelectorAll('[data-variant-choice]').forEach(function (button) {
            button.setAttribute('aria-pressed', String(button.dataset.variantChoice === root.dataset.variant));
        });
    }

    document.querySelectorAll('[data-variant-choice]').forEach(function (button) {
        button.addEventListener('click', function () { choose(button.dataset.variantChoice); });
    });
    window.F1SyncSwitch = sync;
    sync();
})();
