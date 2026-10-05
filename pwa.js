// Update the installed app once; don't reload on its very first installation.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        const wasControlled = Boolean(navigator.serviceWorker.controller);
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (wasControlled && !reloading) { reloading = true; window.location.reload(); }
        });
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            setInterval(() => { if (!document.hidden) registration.update().catch(() => {}); }, 60000);
        } catch (_) { /* A restrictive WebView can still use the complete website. */ }
    });
}
