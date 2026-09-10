/**
 * Roamitra — Explore Page
 */

document.addEventListener('DOMContentLoaded', () => {
    initExploreTabs();
    initFeedFilters();
    initDestinationOpen();
    initDestCylinder();
    initExploreSearch();
});

function destinationUrl(place) {
    const page = typeof RoamitraApi !== 'undefined' ? RoamitraApi.page('destination.html') : 'destination.html';
    return page + '?place=' + encodeURIComponent(place);
}

function showListing() {
    const detail = document.getElementById('destination-detail');
    const forYou = document.getElementById('panel-for-you');
    const local = document.getElementById('panel-local');
    if (detail) detail.hidden = true;
    if (forYou) {
        forYou.hidden = false;
        forYou.classList.add('active');
    }
    if (local) local.classList.remove('active');
    document.querySelectorAll('.explore-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.tab === 'for-you');
    });
    document.title = 'Explore — Roamitra';
}

function openDestination(place, push) {
    const key = String(place || 'bali').toLowerCase();
    const render = window.RoamitraDestinations && window.RoamitraDestinations.renderDestination;
    const detail = document.getElementById('destination-detail');
    if (render && detail) {
        render(key);
        document.getElementById('panel-for-you')?.classList.remove('active');
        document.getElementById('panel-local')?.classList.remove('active');
        const forYou = document.getElementById('panel-for-you');
        if (forYou) forYou.hidden = true;
        detail.hidden = false;
        detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (push) {
            history.pushState({ place: key }, '', 'explore.html?place=' + encodeURIComponent(key));
        }
        return;
    }
    window.location.assign(destinationUrl(key));
}

function initDestinationOpen() {
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.js-open-destination, .destination-card');
        if (!trigger) return;
        if (e.target.closest('.dest-bookmark')) return;
        if (e.target.closest('[data-select-place]')) return;

        let place = trigger.getAttribute('data-place');
        if (!place && trigger.classList.contains('destination-card')) {
            const link = trigger.querySelector('.js-open-destination');
            place = link && link.getAttribute('data-place');
        }
        if (!place) return;

        e.preventDefault();
        e.stopPropagation();
        openDestination(place, true);
    }, true);

    document.getElementById('destBack')?.addEventListener('click', () => {
        showListing();
        history.pushState({}, '', 'explore.html');
    });

    window.addEventListener('popstate', () => {
        const place = new URLSearchParams(location.search).get('place');
        if (place) openDestination(place, false);
        else showListing();
    });

    const initial = new URLSearchParams(location.search).get('place');
    if (initial) openDestination(initial, false);
}

function initExploreTabs() {
    const tabs = document.querySelectorAll('.explore-tab');
    const panels = {
        'for-you': document.getElementById('panel-for-you'),
        'local': document.getElementById('panel-local')
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            showListing();
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            Object.values(panels).forEach(p => {
                if (!p) return;
                p.hidden = false;
                p.classList.remove('active');
            });
            const target = panels[tab.dataset.tab];
            if (target) target.classList.add('active');
        });
    });
}

function initFeedFilters() {
    document.querySelectorAll('.feed-filters .filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.feed-filters .filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
}

function destKeys() {
    const catalog = window.RoamitraDestinations && window.RoamitraDestinations.DESTINATIONS;
    return catalog ? Object.keys(catalog) : [];
}

let cylinderIndex = 0;
let cylinderKeys = [];
let destGridOpen = false;

function destTags(d) {
    return (d.facts || []).slice(0, 3).map((f) => '<span class="dest-tag">' + escapeHtml(f) + '</span>').join('');
}

function destBentoHtml(key, d, featured) {
    return (
        '<article class="dest-tile js-open-destination' + (featured ? ' is-hero' : '') + '" data-place="' + escapeHtml(key) + '">' +
            '<img src="' + escapeHtml(d.image) + '" alt="' + escapeHtml(d.title) + '" loading="lazy">' +
            '<div class="dest-tile-copy">' +
                '<span class="dest-tile-rating"><i class="bi bi-star-fill"></i> ' + escapeHtml(d.rating || '') + '</span>' +
                '<h3>' + escapeHtml(d.title) + '</h3>' +
                '<p>' + escapeHtml(d.price || '') + ' / week</p>' +
            '</div>' +
        '</article>'
    );
}

function applyCoverflow() {
    const scene = document.getElementById('destCylinderScene');
    const catalog = window.RoamitraDestinations && window.RoamitraDestinations.DESTINATIONS;
    const n = cylinderKeys.length;
    if (scene) scene.classList.toggle('is-grid', destGridOpen);

    const label = document.getElementById('destSlideLabel');
    if (label) label.textContent = n ? (cylinderIndex + 1) + ' of ' + n : '0 of 0';

    const allLabel = document.querySelector('.js-dest-all-label');
    if (allLabel) allLabel.textContent = destGridOpen ? 'Show less' : 'See All';

    scene?.querySelectorAll('.dest-cyl-nav').forEach((btn) => {
        btn.hidden = destGridOpen || n < 2;
    });
    const meta = scene?.querySelector('.dest-coverflow-meta');
    if (meta) meta.hidden = destGridOpen;
    const row = document.getElementById('destSpotlightRow');
    const film = document.getElementById('destFilm');
    if (row) row.hidden = destGridOpen;
    if (film) film.hidden = destGridOpen;

    const bento = document.getElementById('destCylinder');
    if (bento) {
        bento.hidden = !destGridOpen;
        if (destGridOpen && catalog) {
            bento.innerHTML = cylinderKeys.map((key, i) => destBentoHtml(key, catalog[key], i === 0)).join('');
        }
    }

    if (destGridOpen || !n || !catalog) return;

    const key = cylinderKeys[cylinderIndex];
    const d = catalog[key];
    const spot = document.getElementById('destSpotlight');
    if (spot && d) {
        spot.dataset.place = key;
        spot.innerHTML =
            '<img src="' + escapeHtml(d.image) + '" alt="' + escapeHtml(d.title) + '">' +
            '<div class="dest-spot-shade"></div>' +
            '<div class="dest-spot-copy">' +
                '<span class="dest-spot-kicker">Now featuring</span>' +
                '<h3>' + escapeHtml(d.title) + '</h3>' +
                '<p>' + escapeHtml(d.desc) + '</p>' +
                '<div class="dest-spot-meta"><span><i class="bi bi-star-fill"></i> ' + escapeHtml(d.rating || '') + '</span><span>' + escapeHtml(d.travelers || '') + '</span><span>' + escapeHtml(d.price || '') + ' / week</span></div>' +
                '<div class="dest-spot-tags">' + destTags(d) + '</div>' +
                '<button type="button" class="js-open-destination btn-roamitra btn-roamitra-navy" data-place="' + escapeHtml(key) + '">Explore this trip</button>' +
            '</div>';
    }

    const stack = document.getElementById('destStack');
    if (stack) {
        const extras = [1, 2].map((off) => cylinderKeys[(cylinderIndex + off) % n]).filter(Boolean);
        stack.innerHTML = extras.map((k) => {
            const item = catalog[k];
            return (
                '<button type="button" class="dest-mini" data-select-place="' + escapeHtml(k) + '">' +
                    '<img src="' + escapeHtml(item.image) + '" alt="">' +
                    '<span><strong>' + escapeHtml(item.title) + '</strong>' + escapeHtml(item.price || '') + '</span>' +
                '</button>'
            );
        }).join('');
    }

    const filmEl = document.getElementById('destFilm');
    if (filmEl) {
        filmEl.innerHTML = cylinderKeys.map((k, i) => {
            const item = catalog[k];
            return (
                '<button type="button" class="dest-chip' + (i === cylinderIndex ? ' is-active' : '') + '" data-select-place="' + escapeHtml(k) + '" aria-label="' + escapeHtml(item.title) + '">' +
                    '<img src="' + escapeHtml(item.image) + '" alt="">' +
                '</button>'
            );
        }).join('');
        const active = filmEl.querySelector('.is-active');
        if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
}

function renderDestCylinder(keys) {
    const catalog = window.RoamitraDestinations && window.RoamitraDestinations.DESTINATIONS;
    const spot = document.getElementById('destSpotlight');
    if (!spot || !catalog) return;

    cylinderKeys = keys;
    if (!cylinderKeys.length) {
        destGridOpen = false;
        spot.innerHTML = '<p class="dest-empty">No matching destinations.</p>';
        const stack = document.getElementById('destStack');
        const film = document.getElementById('destFilm');
        if (stack) stack.innerHTML = '';
        if (film) film.innerHTML = '';
        applyCoverflow();
        return;
    }
    if (cylinderIndex >= cylinderKeys.length) cylinderIndex = 0;
    applyCoverflow();
}

function rollCylinder(delta) {
    if (!cylinderKeys.length || destGridOpen) return;
    cylinderIndex = (cylinderIndex + delta + cylinderKeys.length) % cylinderKeys.length;
    applyCoverflow();
}

function selectDestination(key) {
    const i = cylinderKeys.indexOf(key);
    if (i < 0) return;
    cylinderIndex = i;
    destGridOpen = false;
    applyCoverflow();
}

function toggleDestGrid() {
    if (!cylinderKeys.length) return;
    destGridOpen = !destGridOpen;
    applyCoverflow();
    document.getElementById('destCylinderScene')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function initDestCylinder() {
    if (!document.getElementById('destSpotlight')) return;
    renderDestCylinder(destKeys());

    document.getElementById('seeAllDestinations')?.addEventListener('click', (e) => {
        e.preventDefault();
        showListing();
        toggleDestGrid();
    });
    document.querySelector('.dest-cyl-prev')?.addEventListener('click', () => rollCylinder(-1));
    document.querySelector('.dest-cyl-next')?.addEventListener('click', () => rollCylinder(1));
    document.getElementById('destCylinderScene')?.addEventListener('click', (e) => {
        const pick = e.target.closest('[data-select-place]');
        if (!pick) return;
        e.preventDefault();
        e.stopPropagation();
        selectDestination(pick.getAttribute('data-select-place'));
    });
}

function initExploreSearch() {
    const input = document.querySelector('.search-hero .search-bar input');
    const status = document.getElementById('destSearchStatus');
    if (!input) return;

    const run = (submit) => {
        const q = input.value.trim();
        const find = window.RoamitraDestinations && window.RoamitraDestinations.findDestinations;
        const resolve = window.RoamitraDestinations && window.RoamitraDestinations.resolveDestinationKey;
        if (!find) return;

        const matches = find(q);
        if (status) {
            if (!q) {
                status.hidden = true;
                status.textContent = '';
            } else if (!matches.length) {
                status.hidden = false;
                status.textContent = 'No destinations match “' + q + '”. Try Bali, Tokyo, Paris, Rome, or Iceland.';
            } else {
                status.hidden = false;
                status.textContent = matches.length + ' destination' + (matches.length === 1 ? '' : 's') + ' match “' + q + '”.';
            }
        }

        if (!q) destGridOpen = false;
        renderDestCylinder(q ? matches : destKeys());
        if (q && matches.length) {
            cylinderIndex = 0;
            destGridOpen = false;
            applyCoverflow();
        }

        if (submit && q) {
            const key = resolve ? resolve(q) : matches[0];
            if (key) openDestination(key, true);
        }
    };

    window.RoamitraExploreSearch = run;
    input.addEventListener('input', () => run(false));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            run(true);
        }
    });
}
