/**
 * Roamitra — Main JavaScript
 * Homepage interactions and filter functionality
 */

document.addEventListener('DOMContentLoaded', () => {
    initVehicleFilters();
    initFeatureCards();
    initHostLinks();
    initSeeAll();
    initPageSearch();
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

function closestHideTarget(el) {
    return el.closest('[class*="col-"]') || el;
}

function initSeeAll() {
    document.querySelectorAll('.js-see-all').forEach((btn) => {
        const target = document.querySelector(btn.getAttribute('data-expand') || '');
        if (!target) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const open = target.classList.toggle('see-all-expanded');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            const label = btn.querySelector('.js-see-all-label');
            if (label) label.textContent = open ? 'Show less' : 'See All';
            if (open) {
                target.classList.add('see-all-roll');
                target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    });
}

function initPageSearch() {
    document.querySelectorAll('.search-bar input').forEach((input) => {
        const run = () => {
            if (document.body.dataset.page === 'explore' && typeof window.RoamitraExploreSearch === 'function') {
                return;
            }
            const q = input.value.trim().toLowerCase();
            const items = document.querySelectorAll(
                '.destination-card, .person-row, .place-row, .local-card, .host-card, .stay-card, .feed-post, .vehicle-card'
            );
            let shown = 0;
            items.forEach((el) => {
                const hay = (el.textContent || '').toLowerCase();
                const match = !q || hay.includes(q);
                const wrap = closestHideTarget(el);
                wrap.style.display = match ? '' : 'none';
                if (match) shown += 1;
            });
            const status = document.getElementById('pageSearchStatus');
            if (status) {
                status.hidden = !q;
                status.textContent = q
                    ? (shown ? shown + ' results for “' + input.value.trim() + '”' : 'No matches for “' + input.value.trim() + '”')
                    : '';
            }
        };
        input.addEventListener('input', run);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') e.preventDefault();
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
