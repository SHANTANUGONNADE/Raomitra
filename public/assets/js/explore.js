/**
 * Roamitra — Explore Page
 */

document.addEventListener('DOMContentLoaded', () => {
    initExploreTabs();
    initFeedFilters();
    initLocalFeed();
    initDestinationOpen();
    initDestCylinder();
    initExploreSearch();
    if (location.hash === '#panel-local' || location.hash.startsWith('#feed-')) {
        document.querySelector('.explore-tab[data-tab="local"]')?.click();
    }
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

function applyFeedFilter() {
    const empty = document.getElementById('feedFilterEmpty');
    const active = document.querySelector('.feed-filters .filter-pill.active');
    const filter = active?.dataset.filter || 'all';
    let shown = 0;
    document.querySelectorAll('#panel-local .feed-post[data-feed-category]').forEach((post) => {
        const match = filter === 'all' || post.dataset.feedCategory === filter;
        post.hidden = !match;
        if (match) shown += 1;
    });
    if (empty) empty.hidden = shown !== 0;
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
        safety: 'Safety Alert',
        jobs: 'Part-time Job',
        food: 'Food Tip',
        gems: 'Hidden Gem'
    };
    const category = labels[feed.category] ? feed.category : 'gems';
    const who = feed.full_name || 'You';
    const parts = String(who).trim().split(/\s+/).slice(0, 2);
    const initials = parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'Y';
    const place = feed.place ? ' · ' + escapeHtml(feed.place) : '';
    const remove = feed.mine
        ? '<button type="button" class="feed-action" data-feed-act="delete" aria-label="Delete"><i class="bi bi-trash"></i></button>'
        : '';
    return '<div class="feed-post" data-feed-id="user-' + Number(feed.id) + '" data-feed-db="' + Number(feed.id) + '" data-feed-category="' + escapeHtml(category) + '" data-likes="0" data-comments="0" data-feed-title="' + escapeHtml(feed.title) + '">'
        + '<div class="feed-post-header">'
        + '<div class="feed-post-avatar">' + escapeHtml(initials) + '</div>'
        + '<div class="feed-post-meta">'
        + '<div class="feed-post-name">' + escapeHtml(who) + '</div>'
        + '<div class="feed-post-time">' + escapeHtml(localFeedTime(feed.created_at)) + place + '</div>'
        + '</div>'
        + '<span class="feed-category ' + escapeHtml(category) + '">' + escapeHtml(labels[category]) + '</span>'
        + '</div>'
        + '<p class="feed-post-title">' + escapeHtml(feed.title) + '</p>'
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

    RoamitraApi.get('/local/feeds').then((res) => {
        (res.feeds || []).forEach((feed) => mount(feed, false));
        if (typeof openSavedTip === 'function') openSavedTip();
    }).catch(() => {
        if (typeof openSavedTip === 'function') openSavedTip();
    });
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
                '<button type="button" class="js-open-destination btn-roamitra btn-roamitra-navy" data-place="' + escapeHtml(key) + '">Explore</button>' +
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
        if (active) {
            const left = active.offsetLeft - (filmEl.clientWidth - active.offsetWidth) / 2;
            filmEl.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
        }
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
