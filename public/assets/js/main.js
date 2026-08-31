/**
 * Roamitra — Main JavaScript
 * Homepage interactions and filter functionality
 */

document.addEventListener('DOMContentLoaded', () => {
    initVehicleFilters();
    initFeatureCards();
    initHostLinks();
});

function initHostLinks() {
    document.querySelectorAll('a[href="#"]').forEach(link => {
        if (/list your vehicle/i.test(link.textContent)) {
            link.href = (typeof RoamitraApi !== 'undefined' ? RoamitraApi.page('host.html') : 'host.html') + '?type=vehicle';
        }
    });
}

function initVehicleFilters() {
    const pills = document.querySelectorAll('.vehicle-filters .filter-pill');
    const cards = document.querySelectorAll('.vehicle-card[data-category]');

    if (!pills.length) return;

    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            const filter = pill.dataset.filter;

            cards.forEach(card => {
                const wrap = card.closest('[class*="col-"]') || card.parentElement;
                if (!wrap) return;
                const show = filter === 'all' || card.dataset.category === filter;
                wrap.style.display = show ? '' : 'none';
                if (show) {
                    card.classList.remove('in');
                    card.classList.add('reveal');
                    requestAnimationFrame(() => card.classList.add('in'));
                }
            });
        });
    });
}

function initFeatureCards() {
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const link = card.querySelector('.btn-feature-arrow, .feature-link-text');
            if (link && link.href) {
                window.location.href = link.href;
            }
        });
    });
}
