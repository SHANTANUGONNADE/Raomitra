/**
 * Roamitra — Explore Page
 */

const MUMBAI_LOCAL_TIPS = [
    { category: 'dos', tip: 'Avoid local trains 8–11 AM and 6–9 PM on weekdays; they are packed beyond capacity.' },
    { category: 'transport', tip: 'Buy local train tickets on the UTS app to skip ticket queues.' },
    { category: 'transport', tip: 'Use the m-Indicator app for train, bus and metro timings.' },
    { category: 'transport', tip: 'Trains run on three main lines: Western, Central and Harbour. Check which one you need before boarding.' },
    { category: 'dos', tip: 'Every train has ladies-only compartments; men should not board them.' },
    { category: 'transport', tip: "Auto-rickshaws don't run in South Mumbai (roughly south of Bandra/Sion); use kaali-peeli taxis or app cabs there." },
    { category: 'dos', tip: 'Insist on the meter in autos and black-yellow taxis.' },
    { category: 'planning', tip: 'Best time to visit is November to February. June to September is heavy monsoon with waterlogging.' },
    { category: 'safety', tip: 'During heavy monsoon, check for rain alerts and train delays before heading out; Elephanta ferries may stop.' },
    { category: 'safety', tip: "Don't swim at Mumbai's city beaches; currents are strong and water is polluted." },
    { category: 'dos', tip: "Dress modestly at Haji Ali, Siddhivinayak and other religious sites." },
    { category: 'planning', tip: 'Ganesh Chaturthi (Aug/Sep) is the biggest festival: amazing to see, but roads and trains get very crowded.' },
    { category: 'food', tip: 'Vada pav, pav bhaji, misal pav, bhel puri and Irani chai are must-try street foods.' },
    { category: 'safety', tip: 'Drink only sealed bottled or filtered water.' },
    { category: 'safety', tip: 'Keep phones and wallets in front pockets on crowded trains and markets.' }
];

document.addEventListener('DOMContentLoaded', () => {
    initExploreTabs();
    initFeedFilters();
    initLocalFeed();
    initDestinationOpen();
    initDestCylinder();
    initExploreSearch();
    initNearbyPeople();
    initNearbyPlaces();
    if (location.hash === '#panel-local' || location.hash.startsWith('#feed-')) {
        document.querySelector('.explore-tab[data-tab="local"]')?.click();
    }
});

function initNearbyPeople() {
    const list = document.getElementById('explorePeopleList');
    const status = document.getElementById('explorePeopleStatus');
    const filter = document.getElementById('explorePeopleFilter');
    if (!list || typeof RoamitraApi === 'undefined') return;
    populateNearbyLocationFilter(filter);
    if (filter) {
        let currentLocation = '';
        try { currentLocation = localStorage.getItem('roamitra-local-place') || ''; } catch (e) { /* use all locations */ }
        setNearbyPeopleLocation(filter, currentLocation);
    }

    const load = () => {
        let currentLocation = filter ? filter.value : '';
        if (!filter) {
            try { currentLocation = localStorage.getItem('roamitra-local-place') || ''; } catch (e) { /* use all locations */ }
        }
        const query = currentLocation ? '?location=' + encodeURIComponent(currentLocation) : '';
        return RoamitraApi.get('/community/people' + query).then((data) => {
            const people = Array.isArray(data.people) ? data.people : [];
            if (!people.length) {
                list.innerHTML = '<p class="text-muted mb-0">No registered travelers have shared this location yet.</p>';
                return;
            }
            list.innerHTML = people.map((person) => {
                const name = String(person.full_name || 'Traveler');
                const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?';
                const locationText = String(person.location || '');
                const travelText = person.traveling_to && person.traveling_to !== locationText
                    ? 'Traveling to ' + person.traveling_to
                    : locationText;
                const avatar = person.avatar_url
                    ? '<img src="' + escapeHtml(RoamitraApi.mediaUrl(person.avatar_url)) + '" alt="" class="person-avatar-image">'
                    : escapeHtml(initials);
                return '<div class="person-row">'
                    + '<div class="person-avatar">' + avatar + '</div>'
                    + '<div class="person-info"><div class="person-name">' + escapeHtml(name) + '</div>'
                    + '<div class="person-location">' + escapeHtml(travelText) + '</div>'
                    + (person.bio ? '<div class="person-bio">' + escapeHtml(person.bio) + '</div>' : '')
                    + '</div>'
                    + '<button type="button" class="btn-roamitra btn-roamitra-navy btn-roamitra-sm" data-person-id="' + Number(person.id) + '" data-request-kind="connect" data-request-location="' + escapeHtml(locationText) + '" data-person-name="' + escapeHtml(name) + '" data-person-location="' + escapeHtml(locationText) + '">Connect</button>'
                    + '</div>';
            }).join('');
            initConnectRequests();
            initPeopleChat();
            RoamitraApi.get('/connections').then((social) => {
                const connected = new Set((social.connections || [])
                    .filter((connection) => connection.status === 'accepted')
                    .map((connection) => String(connection.person_id)));
                list.querySelectorAll('[data-person-id]').forEach((button) => {
                    if (connected.has(String(button.dataset.personId))) {
                        button.disabled = false;
                        button.dataset.chat = 'true';
                        button.textContent = 'Chat';
                    }
                });
            }).catch(() => { /* guests do not have connection state */ });
        }).catch(() => {
            if (status) status.textContent = 'Could not load registered travelers right now.';
        });
    };
    filter?.addEventListener('change', load);
    load();
    window.addEventListener('roamitra-location-updated', () => {
        if (filter) {
            let currentLocation = '';
            try { currentLocation = localStorage.getItem('roamitra-local-place') || ''; } catch (e) { /* use all locations */ }
            setNearbyPeopleLocation(filter, currentLocation);
        }
        load();
    });
    window.setInterval(load, 30000);
}

function initNearbyPlaces() {
    const list = document.getElementById('explorePlacesList');
    if (!list) return;
    const filter = document.getElementById('explorePlacesFilter');
    const api = window.RoamitraDestinations;
    const keys = api && Array.isArray(api.FEATURED_DESTINATION_KEYS)
        ? api.FEATURED_DESTINATION_KEYS
        : [];
    populateNearbyLocationFilter(filter);
    const render = () => {
        const city = filter ? filter.value.toLowerCase() : '';
        const matches = city
            ? keys.filter((key) => String(api.DESTINATIONS[key].planner || '').toLowerCase() === city)
            : keys.slice(0, 8);
        if (!matches.length) {
            list.innerHTML = '<p class="text-muted mb-0">No places found for this city.</p>';
            return;
        }
        list.innerHTML = matches.map((key) => {
            const destination = api.DESTINATIONS[key];
            const title = destination.title || key;
            const meta = String(destination.meta || '').split(' · ')[0];
            return '<a href="' + destinationUrl(key) + '" class="place-row js-open-destination" data-place="' + escapeHtml(key) + '">'
                + '<img src="' + escapeHtml(destination.image || '') + '" alt="' + escapeHtml(title) + '" class="place-thumb" loading="lazy">'
                + '<div class="place-info"><h4>' + escapeHtml(title) + '</h4><p>' + escapeHtml(meta) + '</p></div>'
                + '</a>';
        }).join('');
    };
    if (!keys.length) {
        list.innerHTML = '<p class="text-muted mb-0">No destinations available.</p>';
        return;
    }
    if (filter) filter.addEventListener('change', render);
    render();
}

function getExploreCities() {
    const api = window.RoamitraDestinations;
    if (!api || !Array.isArray(api.FEATURED_DESTINATION_KEYS)) return [];
    return Array.from(new Set(api.FEATURED_DESTINATION_KEYS
        .map((key) => String((api.DESTINATIONS[key] || {}).planner || '').trim())
        .filter(Boolean)))
        .sort((a, b) => a.localeCompare(b));
}

function populateNearbyLocationFilter(filter) {
    if (!filter || filter.dataset.ready) return;
    const cities = getExploreCities();
    filter.innerHTML = '<option value="">All cities</option>' + cities.map((city) =>
        '<option value="' + escapeHtml(city) + '">' + escapeHtml(city) + '</option>'
    ).join('');
    filter.dataset.ready = 'true';
}

function setNearbyPeopleLocation(filter, location) {
    if (!filter || !location) return;
    const normalizedLocation = location.toLowerCase();
    const matchingCity = getExploreCities().find((city) => normalizedLocation.includes(city.toLowerCase()));
    const value = matchingCity || location;
    if (!Array.from(filter.options).some((option) => option.value.toLowerCase() === value.toLowerCase())) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        filter.appendChild(option);
    }
    filter.value = value;
}

function initPeopleChat() {
    const modal = document.getElementById('peopleChat');
    const title = document.getElementById('peopleChatTitle');
    const messages = document.getElementById('peopleChatMessages');
    const form = document.getElementById('peopleChatForm');
    if (!modal || !messages || !form || modal.dataset.ready) return;
    modal.dataset.ready = 'true';
    let personId = 0;
    let chatPoll = 0;
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-chat="true"]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        personId = Number(button.dataset.personId || 0);
        title.textContent = 'Chat with ' + (button.dataset.personName || 'traveler');
        modal.hidden = false;
        loadChat();
        window.clearInterval(chatPoll);
        chatPoll = window.setInterval(() => {
            if (!modal.hidden) loadChat();
        }, 5000);
    });
    document.getElementById('peopleChatClose')?.addEventListener('click', () => {
        modal.hidden = true;
        window.clearInterval(chatPoll);
    });
    async function loadChat() {
        if (!personId) return;
        try {
            const data = await RoamitraApi.get('/messages?user_id=' + personId);
            messages.innerHTML = (data.messages || []).map((message) => {
                const incoming = Number(message.sender_id) === personId;
                return '<div class="chat-line ' + (incoming ? 'chat-line-incoming' : 'chat-line-outgoing') + '">'
                    + '<div class="chat-message ' + (incoming ? 'chat-incoming' : 'chat-outgoing') + '">'
                    + '<span class="chat-message-body">' + escapeHtml(message.body) + '</span>'
                    + '<time>' + escapeHtml(formatChatTime(message.created_at)) + '</time>'
                    + '</div></div>';
            }).join('') || '<p class="chat-empty">No messages yet. Start the conversation.</p>';
            messages.scrollTop = messages.scrollHeight;
        } catch (error) {
            messages.innerHTML = '<p class="text-danger">' + escapeHtml(error.message) + '</p>';
        }
    }
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = form.elements.body;
        const body = input.value.trim();
        if (!body || !personId) return;
        try {
            await RoamitraApi.post('/messages', { user_id: personId, body });
            input.value = '';
            await loadChat();
        } catch (error) {
            alert(error.message);
        }
    });
}

function formatChatTime(value) {
    const date = new Date(String(value || '').replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

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

function applyFeedFilter() {
    const empty = document.getElementById('feedFilterEmpty');
    const active = document.querySelector('.feed-filters .filter-pill.active');
    const filter = active?.dataset.filter || 'all';
    const location = currentLocalFeedLocation();
    let shown = 0;
    document.querySelectorAll('#panel-local .feed-post[data-feed-category]').forEach((post) => {
        const categoryMatch = filter === 'all' || post.dataset.feedCategory === filter;
        const locationMatch = localFeedLocationMatches(post, location);
        const match = categoryMatch && locationMatch;
        post.hidden = !match;
        if (match) shown += 1;
    });
    if (empty) {
        empty.hidden = shown !== 0;
        empty.textContent = location
            ? 'No local tips for ' + location + ' in this category yet. Be the first to share one.'
            : 'No local tips in this category yet.';
    }
}

function currentLocalFeedLocation() {
    try { return localStorage.getItem('roamitra-local-place') || ''; } catch (e) { return ''; }
}

function normalizeLocalFeedLocation(value) {
    const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalized === 'bangalore') return 'bengaluru';
    if (normalized === 'bombay') return 'mumbai';
    return normalized;
}

function localFeedLocationMatches(post, location) {
    if (post.dataset.mumbaiOnly === 'true' && !normalizeLocalFeedLocation(location).includes('mumbai')) return false;
    if (!location) return true;
    const selected = normalizeLocalFeedLocation(location);
    const city = normalizeLocalFeedLocation(post.dataset.feedCity);
    const place = normalizeLocalFeedLocation(post.dataset.feedLocation);
    const area = normalizeLocalFeedLocation(post.dataset.feedArea);
    if (city && (selected === city || selected.includes(city))) return true;
    return [place, area].some((value) => value && (value === selected || value.includes(selected) || selected.includes(value)));
}

function escapeFeedAttribute(value) {
    return String(value || '').replace(/[&"'<>]/g, (character) => ({
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;',
        '<': '&lt;',
        '>': '&gt;'
    })[character]);
}

function initFeedFilters() {
    document.querySelectorAll('.feed-filters .filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.feed-filters .filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            applyFeedFilter();
        });
    });
}

function localFeedCard(feed) {
    const labels = {
        dos: "Do's & Don'ts",
        transport: 'Transport',
        planning: 'Planning',
        safety: 'Safety',
        jobs: 'Part-time Job',
        food: 'Food',
        gems: 'Hidden Gem'
    };
    const category = labels[feed.category] ? feed.category : 'gems';
    const who = feed.full_name || 'You';
    const parts = String(who).trim().split(/\s+/).slice(0, 2);
    const initials = parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'Y';
    const place = feed.place ? ' · ' + escapeHtml(feed.place) : '';
    const id = feed.guide ? 'guide-' + String(feed.id) : 'user-' + Number(feed.id);
    const city = feed.city ? ' data-feed-city="' + escapeFeedAttribute(feed.city) + '"' : '';
    const area = feed.area ? ' data-feed-area="' + escapeFeedAttribute(feed.area) + '"' : '';
    const feedPlace = feed.place ? ' data-feed-location="' + escapeFeedAttribute(feed.place) + '"' : '';
    const remove = feed.mine
        ? '<button type="button" class="feed-action" data-feed-act="delete" aria-label="Delete"><i class="bi bi-trash"></i></button>'
        : '';
    const dbId = feed.mine ? ' data-feed-db="' + Number(feed.id) + '"' : '';
    const mumbaiOnly = feed.mumbaiOnly ? ' data-mumbai-only="true"' : '';
    const title = feed.curatedTip ? '' : '<p class="feed-post-title">' + escapeHtml(feed.title) + '</p>';
    return '<div class="feed-post" data-feed-id="' + escapeHtml(id) + '"' + dbId + city + area + feedPlace + mumbaiOnly + ' data-feed-category="' + escapeHtml(category) + '" data-likes="0" data-comments="0" data-feed-title="' + escapeHtml(feed.title) + '">'
        + '<div class="feed-post-header">'
        + '<div class="feed-post-avatar">' + escapeHtml(initials) + '</div>'
        + '<div class="feed-post-meta">'
        + '<div class="feed-post-name">' + escapeHtml(who) + (feed.guide ? ' <span class="feed-verified"><i class="bi bi-patch-check-fill"></i> City Guide</span>' : '') + '</div>'
        + '<div class="feed-post-time">' + escapeHtml(feed.guide ? 'Local tip' : localFeedTime(feed.created_at)) + place + '</div>'
        + '</div>'
        + '<span class="feed-category ' + escapeHtml(category) + '">' + escapeHtml(labels[category]) + '</span>'
        + '</div>'
        + title
        + '<p class="feed-post-content">' + escapeHtml(feed.body) + '</p>'
        + '<div class="feed-post-actions"><div class="feed-actions-left">'
        + '<button type="button" class="feed-action" data-feed-act="like" aria-pressed="false"><i class="bi bi-hand-thumbs-up"></i> <span data-feed-count="likes">0</span></button>'
        + '<button type="button" class="feed-action" data-feed-act="comment" aria-expanded="false"><i class="bi bi-chat"></i> <span data-feed-count="comments">0</span></button>'
        + '</div><div class="feed-actions-right">'
        + '<button type="button" class="feed-action" data-feed-act="save" aria-pressed="false" aria-label="Save"><i class="bi bi-bookmark"></i></button>'
        + '<button type="button" class="feed-action" data-feed-act="share" aria-label="Share"><i class="bi bi-share"></i></button>'
        + remove
        + '</div></div>'
        + '<div class="feed-comments" hidden><ul class="feed-comment-list"></ul>'
        + '<form class="feed-comment-form"><input name="comment" maxlength="280" placeholder="Write a comment…" required>'
        + '<button type="submit" class="btn-roamitra btn-roamitra-navy btn-roamitra-sm">Post</button></form></div></div>';
}

function localFeedTime(value) {
    const then = Date.parse(String(value || '').replace(' ', 'T'));
    if (!then) return 'Just now';
    const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.round(hours / 24) + 'd ago';
}

function initLocalFeedComposer(bindPost, persist, toast, openSavedTip) {
    const list = document.getElementById('localFeedList');
    const form = document.getElementById('localFeedForm');
    const addBtn = document.getElementById('localFeedAdd');
    const clearLocationBtn = document.getElementById('localFeedClearLocation');
    const loginForFeed = () => {
        location.href = RoamitraApi.page('login.html') + '?next=' + encodeURIComponent('explore.html#panel-local');
    };
    const mount = (feed, prepend) => {
        if (!list || !feed) return null;
        const holder = document.createElement('div');
        holder.innerHTML = localFeedCard(feed);
        const post = holder.firstElementChild;
        if (!post) return null;
        if (prepend && list.firstChild) list.insertBefore(post, list.firstChild);
        else list.appendChild(post);
        bindPost(post);
        persist();
        applyFeedFilter();
        return post;
    };

    addBtn?.addEventListener('click', async () => {
        const user = await RoamitraApi.me();
        if (!user) {
            loginForFeed();
            return;
        }
        if (!form) return;
        form.hidden = false;
        form.querySelector('[name="title"]')?.focus();
    });
    document.getElementById('localFeedCancel')?.addEventListener('click', () => {
        if (form) form.hidden = true;
    });
    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const user = await RoamitraApi.me();
        if (!user) {
            loginForFeed();
            return;
        }
        const data = new FormData(form);
        const title = String(data.get('title') || '').trim();
        const body = String(data.get('body') || '').trim();
        const category = String(data.get('category') || '').trim();
        const place = document.querySelector('#panel-local .js-location-label')?.textContent?.trim() || '';
        if (!title || !body) return;
        const submit = form.querySelector('[type="submit"]');
        if (submit) submit.disabled = true;
        try {
            const res = await RoamitraApi.post('/local/feeds', { title, body, category, place });
            document.querySelectorAll('.feed-filters .filter-pill').forEach((pill) => {
                pill.classList.toggle('active', (pill.dataset.filter || '') === 'all');
            });
            const post = mount(res.feed, true);
            form.reset();
            form.hidden = true;
            toast('Tip posted');
            post?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (err) {
            if (err && err.status === 401) {
                loginForFeed();
                return;
            }
            toast((err && err.message) || 'Could not post this tip');
        } finally {
            if (submit) submit.disabled = false;
        }
    });

    const refresh = async (openHash) => {
        if (!list) return;
        list.replaceChildren();
        const selectedLocation = normalizeLocalFeedLocation(currentLocalFeedLocation());
        if (selectedLocation.includes('mumbai')) {
            MUMBAI_LOCAL_TIPS.forEach((tip, index) => {
                mount({
                    id: 'mumbai-sheet-' + index,
                    guide: true,
                    city: 'Mumbai',
                    place: 'Mumbai',
                    category: tip.category,
                    title: tip.tip,
                    body: tip.tip,
                    full_name: 'Roamitra City Guide',
                    curatedTip: true,
                    mumbaiOnly: true
                }, false);
            });
        }
        const mumbaiTips = !selectedLocation || selectedLocation.includes('mumbai')
            ? (window.RoamitraMumbaiData?.places || []).filter((place) => place.local_tip)
            : [];
        mumbaiTips.forEach((place) => {
            const category = /food|restaurant|cafe|street food/i.test(place.category || '') ? 'food' : 'gems';
            mount({
                id: place.key,
                guide: true,
                city: place.planner || 'Mumbai',
                area: place.area || '',
                place: place.area || place.planner || 'Mumbai',
                category,
                title: place.title,
                body: place.local_tip,
                full_name: 'Roamitra City Guide'
            }, false);
        });
        applyFeedFilter();
        try {
            const res = await RoamitraApi.get('/local/feeds');
            if (selectedLocation !== normalizeLocalFeedLocation(currentLocalFeedLocation())) return;
            [...(res.feeds || [])].reverse().forEach((feed) => mount(feed, true));
            applyFeedFilter();
            if (openHash && typeof openSavedTip === 'function') openSavedTip();
        } catch (error) {
            if (openHash && typeof openSavedTip === 'function') openSavedTip();
        }
    };
    const updateClearLocationButton = () => {
        if (clearLocationBtn) clearLocationBtn.hidden = !currentLocalFeedLocation().trim();
    };
    clearLocationBtn?.addEventListener('click', () => {
        try { localStorage.removeItem('roamitra-local-place'); } catch (e) { /* location stays cleared for this page */ }
        document.querySelectorAll('.js-location-label').forEach((label) => {
            label.textContent = 'Set your location';
        });
        updateClearLocationButton();
        window.dispatchEvent(new CustomEvent('roamitra-location-updated'));
    });
    updateClearLocationButton();
    refresh(true);
    window.addEventListener('roamitra-location-updated', () => {
        updateClearLocationButton();
        refresh(false);
    });
    setInterval(() => {
        if (!document.hidden) refresh(false);
    }, 15000);
}

function initLocalFeed() {
    const key = 'roamitra.localFeed';
    let state = {};
    try { state = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { state = {}; }
    const persist = () => {
        try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { /* ignore */ }
    };
    const toast = (message) => {
        let el = document.getElementById('feedToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'feedToast';
            el.className = 'feed-toast';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.classList.add('show');
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
    };

    const bindPost = (post) => {
        if (post.dataset.feedBound === '1') return;
        post.dataset.feedBound = '1';
        const id = post.dataset.feedId;
        const baseLikes = Number(post.dataset.likes || 0);
        const baseComments = Number(post.dataset.comments || 0);
        const entry = Object.assign({ liked: false, saved: false, comments: [], title: post.dataset.feedTitle || '' }, state[id] || {});
        if (!Array.isArray(entry.comments)) entry.comments = [];
        entry.title = post.dataset.feedTitle || entry.title || '';
        entry.body = (post.querySelector('.feed-post-content')?.textContent || '').trim();
        entry.category = post.dataset.feedCategory || entry.category || '';
        state[id] = entry;

        const likeBtn = post.querySelector('[data-feed-act="like"]');
        const commentBtn = post.querySelector('[data-feed-act="comment"]');
        const saveBtn = post.querySelector('[data-feed-act="save"]');
        const shareBtn = post.querySelector('[data-feed-act="share"]');
        const likeCount = post.querySelector('[data-feed-count="likes"]');
        const commentCount = post.querySelector('[data-feed-count="comments"]');
        const box = post.querySelector('.feed-comments');
        const list = post.querySelector('.feed-comment-list');
        const form = post.querySelector('.feed-comment-form');

        const paint = () => {
            if (likeCount) likeCount.textContent = String(baseLikes + (entry.liked ? 1 : 0));
            if (commentCount) commentCount.textContent = String(baseComments + entry.comments.length);
            likeBtn?.classList.toggle('is-on', !!entry.liked);
            likeBtn?.setAttribute('aria-pressed', entry.liked ? 'true' : 'false');
            const likeIcon = likeBtn?.querySelector('i');
            if (likeIcon) likeIcon.className = entry.liked ? 'bi bi-hand-thumbs-up-fill' : 'bi bi-hand-thumbs-up';
            saveBtn?.classList.toggle('is-on', !!entry.saved);
            saveBtn?.setAttribute('aria-pressed', entry.saved ? 'true' : 'false');
            const saveIcon = saveBtn?.querySelector('i');
            if (saveIcon) saveIcon.className = entry.saved ? 'bi bi-bookmark-fill' : 'bi bi-bookmark';
            if (list) {
                list.querySelectorAll('[data-mine]').forEach((node) => node.remove());
                entry.comments.forEach((comment) => {
                    const li = document.createElement('li');
                    li.dataset.mine = '1';
                    const who = document.createElement('strong');
                    who.textContent = 'You';
                    const text = document.createElement('span');
                    text.textContent = comment.text || '';
                    li.append(who, text);
                    list.appendChild(li);
                });
            }
        };
        paint();

        likeBtn?.addEventListener('click', () => {
            entry.liked = !entry.liked;
            entry.likedAt = entry.liked ? Date.now() : 0;
            persist();
            paint();
        });
        saveBtn?.addEventListener('click', () => {
            entry.saved = !entry.saved;
            entry.savedAt = entry.saved ? Date.now() : 0;
            persist();
            paint();
            toast(entry.saved ? 'Saved' : 'Removed from saved');
        });
        commentBtn?.addEventListener('click', () => {
            if (!box) return;
            box.hidden = !box.hidden;
            commentBtn.setAttribute('aria-expanded', box.hidden ? 'false' : 'true');
            if (!box.hidden) form?.querySelector('input')?.focus();
        });
        form?.addEventListener('submit', (event) => {
            event.preventDefault();
            const input = form.querySelector('input');
            const text = (input?.value || '').trim();
            if (!text) return;
            entry.comments.push({ text, at: Date.now() });
            if (input) input.value = '';
            if (box) box.hidden = false;
            persist();
            paint();
            toast('Comment posted');
        });
        shareBtn?.addEventListener('click', async () => {
            const text = (post.querySelector('.feed-post-content')?.textContent || '').trim();
            const url = location.href.split('#')[0] + '#feed-' + encodeURIComponent(id);
            try {
                if (navigator.share) {
                    await navigator.share({ title: 'Roamitra local tip', text, url });
                    return;
                }
            } catch (err) {
                if (err && err.name === 'AbortError') return;
            }
            try {
                await navigator.clipboard.writeText(text + '\n' + url);
                toast('Link copied');
            } catch (err) {
                toast('Could not share this tip');
            }
        });
        post.querySelector('[data-feed-act="delete"]')?.addEventListener('click', async () => {
            const dbId = post.dataset.feedDb;
            if (!dbId || !window.confirm('Delete this tip?')) return;
            try {
                await RoamitraApi.post('/local/feeds/' + dbId + '/delete', {});
                delete state[id];
                persist();
                post.remove();
                applyFeedFilter();
                toast('Tip deleted');
            } catch (err) {
                toast((err && err.message) || 'Could not delete this tip');
            }
        });
    };
    document.querySelectorAll('#panel-local .feed-post[data-feed-id]').forEach(bindPost);
    persist();

    const openSavedTip = () => {
        const hash = location.hash || '';
        if (hash !== '#panel-local' && !hash.startsWith('#feed-')) return;
        document.querySelectorAll('.explore-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.tab === 'local');
        });
        const forYou = document.getElementById('panel-for-you');
        const local = document.getElementById('panel-local');
        if (forYou) forYou.classList.remove('active');
        if (local) {
            local.hidden = false;
            local.classList.add('active');
        }
        const feedId = hash.startsWith('#feed-') ? decodeURIComponent(hash.slice(6)) : '';
        const post = feedId ? document.querySelector('[data-feed-id="' + CSS.escape(feedId) + '"]') : null;
        (post || local)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    openSavedTip();
    window.addEventListener('hashchange', openSavedTip);
    initLocalFeedComposer(bindPost, persist, toast, openSavedTip);
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
}

const DEST_FILM_WINDOW = 24;
const DEST_GRID_PAGE = 48;
let destGridShown = DEST_GRID_PAGE;

function destKeys() {
    const api = window.RoamitraDestinations;
    const catalog = api && api.DESTINATIONS;
    if (!catalog) return [];
    const featured = api.FEATURED_DESTINATION_KEYS;
    if (Array.isArray(featured) && featured.length) {
        return featured.filter((key) => catalog[key]);
    }
    return Object.keys(catalog);
}

function filmIndexes(index, n, size) {
    const out = [];
    if (n <= size) {
        for (let i = 0; i < n; i++) out.push(i);
        return out;
    }
    let start = index - Math.floor(size / 2);
    if (start < 0) start = 0;
    if (start + size > n) start = n - size;
    for (let i = 0; i < size; i++) out.push(start + i);
    return out;
}

let cylinderIndex = 0;
let cylinderKeys = [];
let destGridOpen = false;

function destTags(d) {
    return (d.facts || []).slice(0, 3).map((f) => '<span class="dest-tag">' + escapeHtml(f) + '</span>').join('');
}

function destPhotoUrl(d) {
    return d && d.image ? d.image : '';
}

function destBentoHtml(key, d, featured) {
    if (!d) return '';
    return (
        '<article class="dest-tile js-open-destination' + (featured ? ' is-hero' : '') + '" data-place="' + escapeHtml(key) + '">' +
            '<img src="' + escapeHtml(destPhotoUrl(d)) + '" alt="' + escapeHtml(d.title) + '" loading="lazy" referrerpolicy="no-referrer" data-dest-img="' + escapeHtml(key) + '">' +
            '<div class="dest-tile-copy">' +
                '<span class="dest-tile-rating"><i class="bi bi-star-fill"></i> ' + escapeHtml(d.rating || '') + '</span>' +
                '<h3>' + escapeHtml(d.title) + '</h3>' +
            '</div>' +
        '</article>'
    );
}

const destPhotoCache = new Map();
const destPhotoUsed = new Set();
let destPhotoChain = Promise.resolve();

function destPhotoTokens(text) {
    return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

function destAllowsTransit(title) {
    return /railway|station|metro|train|tram|miniature railway/i.test(title || '');
}

function destIsMemorial(title) {
    return /statue|memorial|smarak|tomb|samadhi|monument/i.test(title || '');
}

function destImageIsUnwanted(dest, imageUrl, pageTitle, description) {
    const title = (dest && dest.title) || '';
    const blob = [imageUrl, pageTitle, description].join(' ').toLowerCase();
    if (!imageUrl) return true;
    if ((/taj mahal|taj_mahal/.test(blob) || /photo-1564507592333/.test(blob)) && !/taj/i.test(title)) return true;
    if (/india_gate|map of|locator|\.svg|flag of|coat of arms/i.test(blob) && !/taj|india gate/i.test(title)) return true;
    if (/portrait|photograph of|photo of|headshot|self-?portrait|oil on canvas|painting of|mugshot|passport|bust of|close-?up|cropped|prime[_ ]minister|narendra|fifa|footballer|actress|sadan[_ ]joseph/i.test(blob)) return true;
    if (/actor|actress|politician|cricketer|footballer|singer|poet|writer|activist|philosopher|yogi|guru|artist|model|chess/i.test(blob) && !destIsMemorial(title)) return true;
    if (/metro station|metro line|metro train|subway|rapid transit|namma metro|delhi metro|rolling stock/i.test(blob) && !destAllowsTransit(title)) return true;
    if (/gateway of india/i.test(title) && /ferry|boat|ship|elephanta|creek/i.test(blob)) return true;
    return false;
}

function destPhotoMatches(dest, pageTitle, imageUrl, description) {
    if (destImageIsUnwanted(dest, imageUrl, pageTitle, description)) return false;
    const title = (dest.title || '').toLowerCase();
    const page = String(pageTitle || '').toLowerCase();
    if ((/taj mahal|taj_mahal/.test(page)) && !/taj/.test(title)) return false;
    if (/india gate|map of|locator/.test(page) && !/india gate/.test(title)) return false;
    const stop = { india: 1, indian: 1, temple: 1, mandir: 1, the: 1, and: 1, of: 1 };
    const words = destPhotoTokens(dest.title).filter((w) => w.length > 3 && !stop[w]);
    if (!words.length) return destPhotoTokens(dest.planner).some((w) => page.includes(w));
    const matched = words.filter((w) => page.includes(w)).length;
    return words.length === 1 ? matched === 1 : matched >= Math.min(2, words.length);
}

function destNeedsPhotoFix(dest) {
    const src = dest && dest.image || '';
    const title = (dest && dest.title) || '';
    if (!src) return true;
    if (destImageIsUnwanted(dest, src, '', '')) return true;
    const catalog = window.RoamitraDestinations && window.RoamitraDestinations.DESTINATIONS;
    if (catalog) {
        const duplicateCount = Object.values(catalog).filter((item) => item && item.image === src).length;
        if (duplicateCount > 1) return true;
    }
    if (/unsplash\.com|photo-1564507592333|photo-1524492412937|taj_mahal|India_Gate/i.test(src) && !/taj/i.test(title)) return true;
    if (destIsMemorial(title) && !/statue|memorial|smarak|monument|sculpt|tomb/i.test(src)) return true;
    if (/library|ashram|university|college/i.test(title) && !/library|ashram|university|college|building|campus|exterior/i.test(src)) return true;
    return false;
}

function normalizeSpotlightImage(dest, sourceUrl) {
    if (!dest || !sourceUrl) return sourceUrl;
    const title = (dest.title || '').toLowerCase();
    const url = String(sourceUrl);
    if (/(jpg|jpeg|png|webp)(\?.*)?$/i.test(url) && !/thumb\.wikimedia|upload\.wikimedia/i.test(url)) {
        return url;
    }
    if (/upload\.wikimedia|thumb\.wikimedia/.test(url) && !/\.svg/i.test(url)) {
        return url;
    }
    if (/(wikipedia|wikimedia|commons)/i.test(url) && /landmark|temple|fort|monument|palace|bridge|bahai|mosque|church|garden|waterfall|beach|ghat/i.test(title)) {
        return url;
    }
    return url;
}

function queueDestWikiPhoto(key, dest, apply) {
    destPhotoChain = destPhotoChain.then(async () => {
        if (destPhotoCache.has(key)) {
            apply(destPhotoCache.get(key));
            return;
        }
        const query = ['"' + (dest.title || key) + '"', dest.planner || '', 'India', destIsMemorial(dest.title) ? 'monument exterior' : 'landmark'].filter(Boolean).join(' ');
        const wiki = 'https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' +
            encodeURIComponent(query) +
            '&gsrlimit=10&prop=pageimages|coordinates|description&piprop=thumbnail&pithumbsize=800&format=json&origin=*';
        const commons = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' +
            encodeURIComponent('"' + (dest.title || key) + '" ' + (dest.planner || '') + ' building -portrait -metro') +
            '&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*';
        let thumb = '';
        try {
            const data = await fetch(wiki).then((r) => r.json());
            const pages = Object.keys((data.query && data.query.pages) || {}).map((id) => data.query.pages[id]);
            pages.sort((a, b) => (b.coordinates ? 1 : 0) - (a.coordinates ? 1 : 0));
            pages.some((page) => {
                const src = page.thumbnail && page.thumbnail.source;
                if (src && destPhotoMatches(dest, page.title, src, page.description) && !destPhotoUsed.has(src)) {
                    thumb = normalizeSpotlightImage(dest, src);
                    return true;
                }
                return false;
            });
            if (!thumb) {
                const files = await fetch(commons).then((r) => r.json());
                const filePages = (files.query && files.query.pages) || {};
                Object.keys(filePages).some((id) => {
                    const info = (filePages[id].imageinfo && filePages[id].imageinfo[0]) || {};
                    const src = info.thumburl || info.url;
                    if (src && destPhotoMatches(dest, filePages[id].title, src) && !destPhotoUsed.has(src)) {
                        thumb = normalizeSpotlightImage(dest, src);
                        return true;
                    }
                    return false;
                });
            }
            if (thumb) {
                destPhotoCache.set(key, thumb);
                destPhotoUsed.add(thumb);
                dest.image = thumb;
                apply(thumb);
            }
        } catch (err) {
            /* keep catalog photo */
        }
        await new Promise((ok) => setTimeout(ok, 70));
    });
}

function hydrateVisibleDestPhotos() {
    const catalog = window.RoamitraDestinations && window.RoamitraDestinations.DESTINATIONS;
    if (!catalog) return;
    document.querySelectorAll('img[data-dest-img]').forEach((img) => {
        const key = img.getAttribute('data-dest-img');
        const dest = catalog[key];
        if (!dest) return;
        const apply = (url) => {
            if (url && img.getAttribute('src') !== url) img.setAttribute('src', url);
        };
        window.RoamitraDestinations.bindImageFallback(
            key,
            img,
            () => queueDestWikiPhoto(key, dest, apply)
        );
        if (destPhotoCache.has(key)) {
            apply(destPhotoCache.get(key));
            destPhotoUsed.add(destPhotoCache.get(key));
            return;
        }
        if (!(window.RoamitraIndiaCities && window.RoamitraIndiaCities[key])) return;
        if (destNeedsPhotoFix(dest)) {
            queueDestWikiPhoto(key, dest, apply);
            return;
        }
        destPhotoUsed.add(dest.image || '');
        if (img.dataset.destAspectBound === '1') return;
        img.dataset.destAspectBound = '1';
        const checkPortrait = () => {
            if (!img.naturalWidth || destPhotoCache.has(key)) return;
            const tall = img.naturalHeight > img.naturalWidth * 1.18;
            const allowTall = /statue|tower|minar|lighthouse|memorial|smarak/i.test(dest.title || '');
            if (tall && !allowTall) queueDestWikiPhoto(key, dest, apply);
        };
        if (img.complete) checkPortrait();
        else img.addEventListener('load', checkPortrait, { once: true });
    });
}

function destLoadMoreHtml(shown, n) {
    const pct = n ? Math.max(8, Math.round((shown / n) * 100)) : 0;
    const remain = Math.max(0, n - shown);
    return (
        '<div class="dest-load-more-wrap">' +
            '<button type="button" class="dest-load-more" data-dest-more>' +
                '<span class="dest-load-more-row">' +
                    '<strong>Load more destinations</strong>' +
                    '<span class="dest-load-more-chip">' + shown.toLocaleString() + ' / ' + n.toLocaleString() + '</span>' +
                '</span>' +
                '<span class="dest-load-more-count">' + remain.toLocaleString() + ' more places to explore</span>' +
                '<span class="dest-load-more-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' +
            '</button>' +
        '</div>'
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
            const shown = Math.min(destGridShown, n);
            const existing = bento.querySelectorAll('.dest-tile').length;
            const sameSet = bento.getAttribute('data-dest-n') === String(n);
            if (sameSet && existing && existing < shown) {
                const moreWrap = bento.querySelector('.dest-load-more-wrap');
                const extras = cylinderKeys.slice(existing, shown).map((key, i) => destBentoHtml(key, catalog[key], existing + i === 0)).join('');
                if (moreWrap) moreWrap.insertAdjacentHTML('beforebegin', extras);
                else bento.insertAdjacentHTML('beforeend', extras);
            } else if (!sameSet || existing !== shown) {
                let html = cylinderKeys.slice(0, shown).map((key, i) => destBentoHtml(key, catalog[key], i === 0)).join('');
                bento.innerHTML = html;
            }
            bento.setAttribute('data-dest-n', String(n));
            const moreWrap = bento.querySelector('.dest-load-more-wrap');
            if (shown < n) {
                if (moreWrap) moreWrap.outerHTML = destLoadMoreHtml(shown, n);
                else bento.insertAdjacentHTML('beforeend', destLoadMoreHtml(shown, n));
            } else if (moreWrap) {
                moreWrap.remove();
            }
            hydrateVisibleDestPhotos();
        }
    }

    if (destGridOpen || !n || !catalog) return;

    const key = cylinderKeys[cylinderIndex];
    const d = catalog[key];
    const spot = document.getElementById('destSpotlight');
    if (spot && d) {
        spot.dataset.place = key;
        spot.innerHTML =
            '<img src="' + escapeHtml(destPhotoUrl(d)) + '" alt="' + escapeHtml(d.title) + '" referrerpolicy="no-referrer" data-dest-img="' + escapeHtml(key) + '">' +
            '<div class="dest-spot-shade"></div>' +
            '<div class="dest-spot-copy">' +
                '<span class="dest-spot-kicker">Now featuring</span>' +
                '<h3>' + escapeHtml(d.title) + '</h3>' +
                '<p>' + escapeHtml(d.desc) + '</p>' +
                '<div class="dest-spot-meta"><span><i class="bi bi-star-fill"></i> ' + escapeHtml(d.rating || '') + '</span><span>' + escapeHtml(d.travelers || '') + '</span></div>' +
                '<div class="dest-spot-tags">' + destTags(d) + '</div>' +
                '<button type="button" class="js-open-destination btn-roamitra btn-roamitra-navy" data-place="' + escapeHtml(key) + '">Explore</button>' +
            '</div>';
    }

    const stack = document.getElementById('destStack');
    if (stack) {
        const extras = [1, 2].map((off) => cylinderKeys[(cylinderIndex + off) % n]).filter(Boolean);
        stack.innerHTML = extras.map((k) => {
            const item = catalog[k];
            if (!item) return '';
            return (
                '<button type="button" class="dest-mini" data-select-place="' + escapeHtml(k) + '">' +
                    '<img src="' + escapeHtml(destPhotoUrl(item)) + '" alt="" referrerpolicy="no-referrer" data-dest-img="' + escapeHtml(k) + '">' +
                    '<span><strong>' + escapeHtml(item.title) + '</strong></span>' +
                '</button>'
            );
        }).join('');
    }

    const filmEl = document.getElementById('destFilm');
    if (filmEl) {
        filmEl.innerHTML = filmIndexes(cylinderIndex, n, DEST_FILM_WINDOW).map((i) => {
            const k = cylinderKeys[i];
            const item = catalog[k];
            if (!item) return '';
            return (
                '<button type="button" class="dest-chip' + (i === cylinderIndex ? ' is-active' : '') + '" data-select-place="' + escapeHtml(k) + '" aria-label="' + escapeHtml(item.title) + '">' +
                    '<img src="' + escapeHtml(destPhotoUrl(item)) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-dest-img="' + escapeHtml(k) + '">' +
                '</button>'
            );
        }).join('');

        const active = filmEl.querySelector('.is-active');
        if (active) {
            const activeLeft = active.offsetLeft;
            const activeWidth = active.offsetWidth;
            const containerWidth = filmEl.clientWidth;
            const desiredLeft = activeLeft - Math.max(0, (containerWidth - activeWidth) / 2);
            const currentLeft = filmEl.scrollLeft;
            const delta = desiredLeft - currentLeft;
            if (Math.abs(delta) > 12) {
                filmEl.scrollTo({ left: Math.max(0, desiredLeft), behavior: 'smooth' });
            }
        }
    }
    hydrateVisibleDestPhotos();
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
    if (destGridOpen) destGridShown = DEST_GRID_PAGE;
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
    const stage = document.getElementById('destCylinderScene');
    let destTimer = setInterval(() => {
        if (document.hidden || destGridOpen) return;
        if (document.getElementById('destination-detail') && !document.getElementById('destination-detail').hidden) return;
        rollCylinder(1);
    }, 1700);
    stage?.addEventListener('mouseenter', () => {
        clearInterval(destTimer);
        destTimer = null;
    });
    stage?.addEventListener('mouseleave', () => {
        if (destTimer) return;
        destTimer = setInterval(() => {
            if (document.hidden || destGridOpen) return;
            rollCylinder(1);
        }, 1700);
    });
    document.getElementById('destCylinderScene')?.addEventListener('click', (e) => {
        const pick = e.target.closest('[data-select-place]');
        if (!pick) return;
        e.preventDefault();
        e.stopPropagation();
        selectDestination(pick.getAttribute('data-select-place'));
    });
    document.getElementById('destCylinder')?.addEventListener('click', (e) => {
        const more = e.target.closest('[data-dest-more]');
        if (!more) return;
        e.preventDefault();
        destGridShown = Math.min(destGridShown + DEST_GRID_PAGE, cylinderKeys.length);
        applyCoverflow();
    });
}

function initExploreSearch() {
    const input = document.querySelector('.search-hero .search-bar input');
    const status = document.getElementById('destSearchStatus');
    if (!input) return;
    const wrapper = input.closest('.search-bar-wrapper');
    let suggestions = wrapper?.querySelector('.destination-suggestions');
    if (!suggestions && wrapper) {
        suggestions = document.createElement('div');
        suggestions.className = 'destination-suggestions';
        suggestions.hidden = true;
        wrapper.appendChild(suggestions);
    }

    const paintSuggestions = (matches, query) => {
        if (!suggestions) return;
        if (!query || !matches.length) {
            suggestions.hidden = true;
            suggestions.classList.remove('is-scrollable');
            suggestions.innerHTML = '';
            return;
        }
        const catalog = window.RoamitraDestinations.DESTINATIONS;
        suggestions.innerHTML = matches.map((key) => {
            const destination = catalog[key];
            return `<button type="button" class="destination-suggestion" data-suggestion-place="${escapeHtml(key)}">
                <span class="destination-suggestion-icon"><i class="bi bi-geo-alt"></i></span>
                <span><strong>${escapeHtml(destination.title)}</strong><small>${escapeHtml(destination.planner || destination.meta || 'India')}</small></span>
            </button>`;
        }).join('');
        suggestions.classList.toggle('is-scrollable', matches.length > 4);
        suggestions.hidden = false;
        suggestions.querySelectorAll('[data-suggestion-place]').forEach((button) => {
            button.addEventListener('click', () => {
                const key = button.dataset.suggestionPlace;
                input.value = catalog[key].title;
                suggestions.hidden = true;
                suggestions.classList.remove('is-scrollable');
                openDestination(key, true);
            });
        });
    };

    const run = (submit) => {
        const q = input.value.trim();
        const find = window.RoamitraDestinations && window.RoamitraDestinations.findDestinations;
        const resolve = window.RoamitraDestinations && window.RoamitraDestinations.resolveDestinationKey;
        if (!find) return;

        const normalized = q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const matches = find(q).filter((key) => {
            if (!normalized) return true;
            const destination = window.RoamitraDestinations.DESTINATIONS[key] || {};
            const city = String(destination.planner || '').toLowerCase();
            return city.includes(normalized) || destinationSearchTerms(key, destination).includes(normalized);
        });
        paintSuggestions(matches, q);
        if (status) {
            if (!q) {
                status.hidden = true;
                status.textContent = '';
            } else if (!matches.length) {
                status.hidden = false;
                status.textContent = 'No destinations match “' + q + '”. Try Agra, Mumbai, Jaipur, or Goa.';
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
        } else if (e.key === 'Escape' && suggestions) {
            suggestions.hidden = true;
        }
    });
    input.addEventListener('focus', () => {
        if (input.value.trim()) run(false);
    });
    document.addEventListener('click', (event) => {
        if (wrapper && !wrapper.contains(event.target) && suggestions) {
            suggestions.hidden = true;
            suggestions.classList.remove('is-scrollable');
        }
    });
}

function destinationSearchTerms(key, destination) {
    return [key, destination.title, destination.planner, destination.meta, destination.desc, destination.keywords]
        .filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}
