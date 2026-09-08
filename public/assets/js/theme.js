(function () {
    const KEY = 'roamitra-theme';
    const saved = localStorage.getItem(KEY);
    const theme = saved === 'dark' || saved === 'light' ? saved : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    window.RoamitraTheme = {
        current() {
            return document.documentElement.getAttribute('data-theme') || 'light';
        },
        toggle() {
            const next = this.current() === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem(KEY, next);
            document.dispatchEvent(new CustomEvent('roamitra-theme', { detail: next }));
            return next;
        }
    };
})();
