// ============================================================
// Custom confirm dialog (replaces the native browser confirm() popup)
// - Always centered on screen.
// - Automatically follows the current theme (dark / red) via CSS,
//   since it reuses the same body.red-theme rules as every other modal.
// - Usage: showConfirm('Delete this song?').then((ok) => { if (ok) ... });
//   or with async/await: const ok = await showConfirm('...');
// ============================================================
(function () {
    'use strict';

    const overlay = document.getElementById('confirm-dialog-overlay');
    const messageEl = document.getElementById('confirm-dialog-message');
    const cancelBtn = document.getElementById('confirm-dialog-cancel');
    const confirmBtn = document.getElementById('confirm-dialog-confirm');

    if (!overlay || !messageEl || !cancelBtn || !confirmBtn) {
        // Markup missing (old cached HTML) - fall back to native confirm so
        // delete actions still work.
        window.showConfirm = (message) => Promise.resolve(window.confirm(message));
        return;
    }

    let activeResolve = null;

    function close(result) {
        overlay.classList.remove('open');
        if (activeResolve) {
            activeResolve(result);
            activeResolve = null;
        }
    }

    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('open')) close(false);
    });

    // options: { confirmText, cancelText }
    window.showConfirm = function (message, options) {
        options = options || {};
        messageEl.textContent = message;
        confirmBtn.textContent = options.confirmText || 'Delete';
        cancelBtn.textContent = options.cancelText || 'Cancel';
        overlay.classList.add('open');
        return new Promise((resolve) => {
            activeResolve = resolve;
        });
    };
})();
