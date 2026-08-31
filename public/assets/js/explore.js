/**
 * Roamitra — Explore Page
 */

document.addEventListener('DOMContentLoaded', () => {
    initExploreTabs();
    initFeedFilters();
    initDestinationOpen();
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
