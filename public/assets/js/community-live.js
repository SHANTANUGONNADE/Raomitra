document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('liveQuestions');
    const form = document.getElementById('communityForm');
    if (!list || !form) return;

    document.querySelectorAll('.comm-ask-stage > .feed-post').forEach((post) => post.remove());

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    // Moved to top-level scope so it can be called independently of refresh()
    async function refreshStats() {
        try {
            const data = await RoamitraApi.get('/community/stats');
            const stats = data.stats || {};
            document.querySelectorAll('[data-community-stat]').forEach((element) => {
                const value = Number(stats[element.dataset.communityStat] || 0);
                element.textContent = value.toLocaleString();
            });
        } catch (error) {
            document.querySelectorAll('[data-community-stat]').forEach((element) => {
                element.textContent = '—';
            });
        }
    }

    async function refresh() {
        try {
            const data = await RoamitraApi.get('/community/posts');
            const posts = data.posts || [];
            const questionStat = document.querySelector('.comm-stats-strip .stat-green .stat-value');
            if (questionStat) questionStat.textContent = String(posts.length);
            if (!posts.length) {
                list.innerHTML = '<p class="text-muted">No community questions yet. Be the first to ask.</p>';
                return;
            }

            list.innerHTML = posts.map(p => `
                <article class="feed-post live-post" data-id="${p.id}">
                    <div class="feed-post-header">
                        <div class="feed-post-avatar">${escapeHtml((p.full_name || '?').charAt(0))}</div>
                        <div class="feed-post-meta">
                            <div class="feed-post-name">${escapeHtml(p.full_name)}</div>
                            <div class="feed-post-time">${escapeHtml(p.created_at)} · ${p.reply_count} replies</div>
                        </div>
                    </div>
                    <h3 class="h6 mb-1">${escapeHtml(p.title)}</h3>
                    <p class="feed-post-content">${escapeHtml(p.body)}</p>
                    <form class="reply-form">
                        <label class="visually-hidden" for="reply-${p.id}">Reply</label>
                        <input id="reply-${p.id}" name="body" placeholder="Write a reply…" required>
                        <button type="submit" class="btn-roamitra btn-roamitra-navy btn-roamitra-sm">Reply</button>
                    </form>
                </article>
            `).join('');

            list.querySelectorAll('.reply-form').forEach(rf => {
                rf.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const postId = rf.closest('[data-id]').dataset.id;
                    const body = rf.body.value.trim();
                    try {
                        await RoamitraApi.post(`/community/posts/${postId}/replies`, { body });
                        rf.body.value = '';
                        await refresh();
                    } catch (err) {
                        if (err.status === 401) window.location.href = RoamitraApi.page('login.html');
                        else alert(err.message);
                    }
                });
            });
        } catch (e) {
            list.innerHTML = '<p class="text-muted">Could not load live questions.</p>';
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(form).entries());
        try {
            await RoamitraApi.post('/community/posts', payload);
            form.reset();
            await refresh();
        } catch (err) {
            if (err.status === 401) window.location.href = RoamitraApi.page('login.html');
            else alert(err.message);
        }
    });

    refresh();
    refreshStats();

    async function refreshHosts() {
        const locals = document.getElementById('localsGrid');
        const hosts = document.getElementById('hostsGrid');
        const hostPanel = document.getElementById('commHostPanel');
        if (!locals && !hosts) return;
        if (locals) locals.innerHTML = '<p class="text-muted">Loading registered travelers...</p>';
        if (hosts) hosts.innerHTML = '<p class="text-muted">Loading approved hosts...</p>';
        try {
            const [peopleData, hostData] = await Promise.all([
                RoamitraApi.get('/community/people'),
                RoamitraApi.get('/hosts')
            ]);
            const people = peopleData.people || [];
            const hostsList = hostData.hosts || [];
            const renderLocal = (person) => {
                const name = person.full_name || 'Verified host';
                const location = person.location || 'India';
                const avatar = person.avatar_url ? RoamitraApi.mediaUrl(person.avatar_url) : '';
                return `<div class="col-lg-3 col-md-6"><div class="local-card" data-person-id="${Number(person.id)}">
                    ${avatar ? `<img src="${escapeHtml(avatar)}" alt="" class="local-avatar" loading="lazy">` : `<div class="local-avatar host-avatar-fallback">${escapeHtml(name.charAt(0))}</div>`}
                    <div class="local-name">${escapeHtml(name)}</div>
                    <div class="local-location">${escapeHtml(location || 'India')}</div>
                    <p class="host-bio">${escapeHtml(person.traveling_to ? 'Travelling to ' + person.traveling_to : person.bio || 'Registered Roamitra traveler.')}</p>
                    <button class="btn-roamitra btn-roamitra-navy btn-roamitra-block btn-roamitra-sm" data-person-id="${Number(person.id)}" data-person-name="${escapeHtml(name)}">Connect</button>
                </div></div>`;
            };
            const renderHost = (person) => {
                const name = person.full_name || 'Verified host';
                const location = [person.city || person.location, person.country].filter(Boolean).join(', ');
                const avatar = person.avatar_url ? RoamitraApi.mediaUrl(person.avatar_url) : '';
                return `<div class="col-lg-4 col-md-6"><article class="host-person" data-person-id="${Number(person.id)}">
                    <div class="host-person-top"><div class="host-avatar-wrap">${avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : `<span class="host-avatar-fallback">${escapeHtml(name.charAt(0))}</span>`}<span class="host-online"></span></div>
                    <div><h2>${escapeHtml(name)} <i class="bi bi-patch-check-fill"></i></h2><p class="host-loc"><i class="bi bi-geo-alt"></i> ${escapeHtml(location || 'India')}</p><p class="host-since">Verified host</p></div></div>
                    <p class="host-bio">${escapeHtml(person.bio || 'Approved Roamitra host.')}</p>
                    <button type="button" class="host-ask" data-host-form data-person-id="${Number(person.id)}" data-host-name="${escapeHtml(name)}">Ask to<br>Host</button>
                </article></div>`;
            };
            if (locals) locals.innerHTML = people.map(renderLocal).join('') || '<p class="text-muted">No registered travelers found yet.</p>';
            if (hosts) hosts.innerHTML = hostsList.map(renderHost).join('') || '<p class="text-muted">No approved hosts registered yet.</p>';
            if (hostPanel) {
                hostPanel.querySelectorAll('.host-person').forEach((card) => card.remove());
                hostPanel.querySelectorAll('.live-host-list').forEach((list) => list.remove());
                const heading = hostPanel.querySelector('.host-block-title');
                const live = document.createElement('div');
                live.className = 'row g-3 mb-4 live-host-list';
                live.innerHTML = hostsList.map(renderHost).join('') || '<p class="text-muted">No approved hosts registered yet.</p>';
                if (heading) heading.after(live);
            }
            if (typeof initConnectRequests === 'function') initConnectRequests();
        } catch (error) {
            [locals, hosts].filter(Boolean).forEach((target) => { target.innerHTML = '<p class="text-muted">Could not load verified hosts.</p>'; });
        }
    }

    refreshHosts();
    setInterval(refresh, 30000);
    setInterval(refreshStats, 30000);
    setInterval(refreshHosts, 30000);

    const pin = document.querySelector('.comm-feature-pin');
    if (pin && window.matchMedia('(min-width: 992px)').matches) {
        const sentinel = document.createElement('div');
        sentinel.setAttribute('aria-hidden', 'true');
        sentinel.style.height = '1px';
        pin.before(sentinel);
        const watcher = new IntersectionObserver(([entry]) => {
            pin.classList.toggle('is-stuck', !entry.isIntersecting);
        }, { threshold: 1 });
        watcher.observe(sentinel);
    }

    const under = document.getElementById('commUnder');
    const hostPanel = document.getElementById('commHostPanel');
    const rentPanel = document.getElementById('commRentPanel');
    const meetupPanel = document.getElementById('commMeetupPanel');
    window.RoamitraCommunityOpen = function (which, listing) {
        if (!under) return;
        under.hidden = false;
        if (pin) pin.classList.remove('is-released');
        if (hostPanel) hostPanel.hidden = which !== 'host';
        if (rentPanel) rentPanel.hidden = which !== 'rent';
        if (meetupPanel) meetupPanel.hidden = which !== 'meetup';
        if (which === 'host' && listing === 'vehicle') {
            const radio = document.querySelector('#commHostForm input[value="vehicle"]');
            const wrap = document.getElementById('commVehicleWrap');
            if (radio) radio.checked = true;
            if (wrap) wrap.hidden = false;
            document.getElementById('commHostApply')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        const target = which === 'host' ? document.getElementById('commHostTop') : under;
        (target || under).scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    document.addEventListener('click', (event) => {
        const formBtn = event.target.closest('[data-host-form]');
        if (formBtn) {
            event.preventDefault();
            if (!formBtn.classList.contains('host-ask')) {
                document.getElementById('commHostApply')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return;
            }
            const sheet = document.getElementById('commAskSheet');
            const person = formBtn.closest('.host-person');
            const name = formBtn.dataset.hostName || 'this host';
            if (sheet && person) {
                person.after(sheet);
                sheet.hidden = false;
                const title = document.getElementById('commAskTitle');
                const lead = document.getElementById('commAskLead');
                const note = document.getElementById('commAskNote');
                const status = document.getElementById('commAskStatus');
                if (title) title.textContent = 'Ask ' + name + ' to host';
                if (lead) lead.textContent = 'Send a short note to ' + name + '. It stays on this page.';
                if (note) note.value = '';
                if (status) status.hidden = true;
                sheet.dataset.hostName = name;
                sheet.dataset.personId = formBtn.dataset.personId || '';
                sheet.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                note?.focus();
            } else {
                document.getElementById('commHostApply')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return;
        }
        const opener = event.target.closest('[data-open]');
        if (!opener || !under) return;
        event.preventDefault();
        window.RoamitraCommunityOpen(opener.dataset.open, opener.dataset.listing || '');
    });

    document.getElementById('commAskSend')?.addEventListener('click', async () => {
        const sheet = document.getElementById('commAskSheet');
        const status = document.getElementById('commAskStatus');
        const note = document.getElementById('commAskNote');
        const name = sheet?.dataset.hostName || 'this host';
        const personId = Number(sheet?.dataset.personId || 0);
        const text = (note?.value || '').trim();
        if (!text) {
            if (status) {
                status.hidden = false;
                status.textContent = 'Write a short note first.';
            }
            note?.focus();
            return;
        }
        try {
            // Send as a connect request so the server handler accepts it
            await RoamitraApi.post('/community/requests', {
                kind: 'connect',
                person_id: personId,
                person_name: name,
                note: text
            });
            if (status) {
                status.hidden = false;
                status.textContent = 'Request sent to ' + name + '.';
            }
            const btn = sheet?.previousElementSibling?.querySelector('.host-ask');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Requested';
            }
        } catch (error) {
            if (error.status === 401) {
                window.location.href = RoamitraApi.page('login.html');
            } else if (status) {
                status.hidden = false;
                status.textContent = error.message || 'Could not send this request.';
            }
        }
    });

    const hostForm = document.getElementById('commHostForm');
    const hostStatus = document.getElementById('commHostStatus');
    const hostExisting = document.getElementById('commHostExisting');
    const vehicleWrap = document.getElementById('commVehicleWrap');
    if (hostForm && vehicleWrap) {
        hostForm.querySelectorAll('input[name="listing_type"]').forEach((el) => {
            el.addEventListener('change', () => {
                const type = hostForm.querySelector('input[name="listing_type"]:checked')?.value;
                vehicleWrap.hidden = type !== 'vehicle';
            });
        });
        hostForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (hostStatus) hostStatus.hidden = true;
            const btn = document.getElementById('commHostSubmit');
            if (btn) btn.disabled = true;
            const payload = Object.fromEntries(new FormData(hostForm).entries());
            try {
                const data = await RoamitraApi.post('/host/apply', payload);
                if (hostStatus) {
                    hostStatus.className = 'form-alert';
                    hostStatus.textContent = data.message || 'Your host request was sent to admin.';
                    hostStatus.hidden = false;
                }
                hostForm.hidden = true;
            } catch (err) {
                if (err.status === 401) {
                    window.location.href = RoamitraApi.page('login.html') + '?next=' + encodeURIComponent('host.html');
                    return;
                }
                if (hostStatus) {
                    hostStatus.className = 'form-alert error';
                    hostStatus.textContent = err.message || 'Could not submit application.';
                    hostStatus.hidden = false;
                }
                if (btn) btn.disabled = false;
            }
        });
    }

    const openFromHash = () => {
        const hash = location.hash;
        if (hash === '#ask-host') {
            window.location.replace(RoamitraApi.page('host.html'));
            return;
        }
        if (hash === '#ask-rent' || hash === '#rent-section') {
            window.location.replace(RoamitraApi.page('rentals.html'));
            return;
        }
        if (hash === '#ask-meetup') {
            window.location.replace(RoamitraApi.page('meetups.html'));
        }
    };

    const activityBadge = document.getElementById('activityCount');
    if (activityBadge) {
        try {
            const [profile, notes] = await Promise.all([
                RoamitraApi.get('/profile'),
                RoamitraApi.get('/notifications')
            ]);
            let localCount = 0;
            try {
                const saved = JSON.parse(localStorage.getItem('roamitra.localFeed') || '{}');
                Object.values(saved).forEach((entry) => {
                    if (!entry) return;
                    if (entry.saved) localCount += 1;
                    if (entry.liked) localCount += 1;
                    localCount += Array.isArray(entry.comments) ? entry.comments.length : 0;
                });
            } catch (e) { /* ignore */ }
            const total = (profile.trips || []).length
                + (profile.bookings || []).length
                + (profile.host_application ? 1 : 0)
                + (profile.transactions || []).length
                + (notes.notifications || []).length
                + localCount;
            activityBadge.hidden = total === 0;
            activityBadge.textContent = total > 99 ? '99+' : String(total);
        } catch (e) {
            activityBadge.hidden = true;
        }
    }
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
});
