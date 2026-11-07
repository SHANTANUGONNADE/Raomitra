/**
 * Roamitra — Component Loader
 * Loads reusable HTML components (navbar, footer, AI assistant)
 */

const RoamitraComponents = {
    basePath: 'assets/components/',

    async load(targetId, componentFile) {
        const target = document.getElementById(targetId);
        if (!target) return;

        try {
            const response = await fetch(`${this.basePath}${componentFile}`);
            if (!response.ok) throw new Error(`Failed to load ${componentFile}`);
            target.innerHTML = await response.text();

            if (componentFile === 'navbar.html') {
                this.setActiveNavLink();
            }
            if (componentFile === 'ai-assistant.html') {
                if (typeof RoamitraAI !== 'undefined') {
                    RoamitraAI.init();
                }
            }
        } catch (error) {
            console.warn(`Component load error (${componentFile}):`, error.message);
        }
    },

    setActiveNavLink() {
        const currentPage = document.body.dataset.page;
        if (!currentPage) return;

        document.querySelectorAll('[data-nav]').forEach(link => {
            if (link.dataset.nav === currentPage) {
                link.classList.add('active');
            }
        });
    },

    init() {
        this.load('navbar-container', 'navbar.html');
        this.load('footer-container', 'footer.html');
        this.load('ai-assistant-container', 'ai-assistant.html');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    RoamitraComponents.init();
});
