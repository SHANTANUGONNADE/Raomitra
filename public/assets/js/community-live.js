document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('liveQuestions');
    const form = document.getElementById('communityForm');
    if (!list || !form) return;

    async function refresh() {
        try {
            const data = await RoamitraApi.get('/community/posts');
            const posts = data.posts || [];
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

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    refresh();

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

    document.getElementById('commAskSend')?.addEventListener('click', () => {
        const sheet = document.getElementById('commAskSheet');
        const status = document.getElementById('commAskStatus');
        const note = document.getElementById('commAskNote');
        const name = sheet?.dataset.hostName || 'this host';
        const text = (note?.value || '').trim();
        if (!text) {
            if (status) {
                status.hidden = false;
                status.textContent = 'Write a short note first.';
            }
            note?.focus();
            return;
        }
        const key = 'roamitra.hostAsks';
        const saved = JSON.parse(localStorage.getItem(key) || '[]');
        saved.unshift({ host: name, note: text, at: Date.now() });
        localStorage.setItem(key, JSON.stringify(saved.slice(0, 20)));
        if (status) {
            status.hidden = false;
            status.textContent = 'Request sent to ' + name + '.';
        }
        const btn = sheet?.previousElementSibling?.querySelector('.host-ask');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Requested';
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
                    window.location.href = RoamitraApi.page('login.html') + '?next=' + encodeURIComponent('community.html#ask-host');
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
        if (hash === '#ask-host') window.RoamitraCommunityOpen('host');
        else if (hash === '#ask-rent' || hash === '#rent-section') window.RoamitraCommunityOpen('rent');
        else if (hash === '#ask-meetup') window.RoamitraCommunityOpen('meetup');
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
});
