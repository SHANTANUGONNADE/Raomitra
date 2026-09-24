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
    initLocalLocations();
});

function initLocalLocations() {
    const placeKey = 'roamitra-local-place';
    const cardKey = 'roamitra-local-cards';
    let place = '';
    let cards = {};
    try {
        place = localStorage.getItem(placeKey) || '';
        cards = JSON.parse(localStorage.getItem(cardKey) || '{}') || {};
    } catch (e) {
        cards = {};
    }

    document.querySelectorAll('.js-location-label').forEach((el) => {
        if (place) el.textContent = place;
    });

    async function savePlace(value, previous) {
        if (!value || value === previous || value.length > 120) return;
        try { localStorage.setItem(placeKey, value); } catch (e) { /* ignore */ }
        document.querySelectorAll('.js-location-label').forEach((el) => { el.textContent = value; });
        try {
            if (typeof RoamitraApi === 'undefined') return;
            const me = await RoamitraApi.me();
            if (!me) return;
            await RoamitraApi.post('/profile', {
                full_name: me.full_name,
                bio: me.bio || '',
                location: value
            });
        } catch (e) { /* location still saved on this device */ }
    }

    document.querySelectorAll('.js-edit-location').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.querySelector('input')) return;
            const label = btn.querySelector('.js-location-label');
            if (!label) return;
            const current = label.textContent.trim();
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'location-chip-input';
            input.value = current;
            input.maxLength = 120;
            input.setAttribute('aria-label', 'Edit location');
            label.replaceWith(input);
            input.focus();
            input.select();
            let closed = false;
            const close = () => {
                if (closed) return;
                closed = true;
                const value = input.value.trim();
                const span = document.createElement('span');
                span.className = 'js-location-label';
                span.textContent = value || current;
                if (input.isConnected) input.replaceWith(span);
                savePlace(value, current);
            };
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                } else if (e.key === 'Escape') {
                    input.value = current;
                    input.blur();
                }
            });
            input.addEventListener('blur', close);
        });
    });

    document.querySelectorAll('.local-card .local-location').forEach((el) => {
        const card = el.closest('.local-card');
        const rawName = card && card.querySelector('.local-name')
            ? card.querySelector('.local-name').childNodes[0].textContent
            : el.textContent;
        const name = String(rawName || '').trim();
        const text = document.createElement('span');
        text.className = 'local-location-text';
        text.textContent = cards[name] || el.textContent.trim();
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'local-loc-edit';
        edit.setAttribute('aria-label', 'Edit location');
        edit.innerHTML = '<i class="bi bi-pencil"></i>';
        edit.addEventListener('click', () => {
            const next = window.prompt('Edit location for ' + name, text.textContent.trim());
            if (next == null) return;
            const value = next.trim();
            if (!value || value.length > 120) return;
            text.textContent = value;
            cards[name] = value;
            try { localStorage.setItem(cardKey, JSON.stringify(cards)); } catch (e) { /* ignore */ }
        });
        el.textContent = '';
        el.append(text, edit);
    });
}

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
            const opener = e.target.closest('[data-open]') || card.querySelector('[data-open]');
            if (opener && window.RoamitraCommunityOpen) {
                e.preventDefault();
                window.RoamitraCommunityOpen(opener.dataset.open);
                return;
            }
            if (e.target.closest('a')) return;
            const link = card.querySelector('.btn-feature-arrow, .feature-link-text');
            if (link && link.href) {
                window.location.href = link.href;
            }
        });
    });
}
