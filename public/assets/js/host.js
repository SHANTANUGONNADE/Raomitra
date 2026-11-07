document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(location.search);
    if (params.get('type') === 'vehicle') {
        const vehicleRadio = document.querySelector('input[name="listing_type"][value="vehicle"]');
        if (vehicleRadio) vehicleRadio.checked = true;
    }

    const vehicleWrap = document.getElementById('vehicleWrap');
    const syncType = () => {
        const type = document.querySelector('input[name="listing_type"]:checked')?.value;
        vehicleWrap.hidden = type !== 'vehicle';
    };
    document.querySelectorAll('input[name="listing_type"]').forEach(el => el.addEventListener('change', syncType));
    syncType();

    const statusBox = document.getElementById('hostStatus');
    const existing = document.getElementById('hostExisting');
    const form = document.getElementById('hostForm');

    async function loadHosts() {
        const featured = document.getElementById('hostFeatured');
        const all = document.getElementById('hostAll');
        if (!featured || !all) return;
        try {
            const data = await RoamitraApi.get('/hosts');
            const hosts = data.hosts || [];
            document.querySelectorAll('.host-person').forEach((card) => card.remove());
            const card = (host) => {
                const name = host.full_name || 'Verified host';
                const location = [host.city || host.location, host.country].filter(Boolean).join(', ');
                const avatar = host.avatar_url ? RoamitraApi.mediaUrl(host.avatar_url) : '';
                return `<article class="host-person">
                    <div class="host-person-top">
                        <div class="host-avatar-wrap">${avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : `<span class="host-avatar-fallback">${escapeHtml(name.charAt(0))}</span>`}<span class="host-online"></span></div>
                        <div><h2>${escapeHtml(name)} <i class="bi bi-patch-check-fill"></i></h2><p class="host-loc"><i class="bi bi-geo-alt"></i> ${escapeHtml(location || 'India')}</p><p class="host-since">Verified host</p></div>
                    </div>
                    <p class="host-bio">${escapeHtml(host.bio || 'Approved Roamitra host ready to help travelers.')}</p>
                    <div class="host-person-foot"><div class="host-foot-meta"><span><i class="bi bi-check-circle-fill"></i> Approved</span></div><a class="host-ask" href="#hostApply">Ask to<br>Host</a></div>
                </article>`;
            };
            featured.innerHTML = hosts.slice(0, 8).map((host) => `<article class="host-feature-card"><div class="host-avatar-fallback">${escapeHtml((host.full_name || 'H').charAt(0))}</div><div><strong>${escapeHtml(host.full_name || 'Verified host')} <i class="bi bi-patch-check-fill"></i></strong><p><i class="bi bi-geo-alt"></i> ${escapeHtml(host.city || host.location || 'India')}</p><small><span class="host-live"><i class="bi bi-circle-fill"></i> Verified</span></small></div></article>`).join('');
            all.innerHTML = hosts.map(card).join('') || '<p class="form-alert">No approved hosts are registered yet.</p>';
        } catch (error) {
            all.innerHTML = `<p class="form-alert error">${escapeHtml(error.message || 'Could not load hosts.')}</p>`;
        }
    }
    loadHosts();

    async function refreshApplication() {
        const data = await RoamitraApi.get('/host/me');
        const app = data.application;
        const role = data.user?.role;
        if (role === 'host' || role === 'admin' || role === 'co_admin') {
            existing.hidden = false;
            existing.innerHTML = `<h3 class="h5 mb-2">You are already a ${escapeHtml(role)}</h3>
                <p class="mb-0">Staff and verified hosts do not submit this form. Sign in as a member to send a host request to admin.</p>`;
            form.hidden = true;
        } else if (app) {
            showExisting(app);
            form.hidden = app.status === 'pending' || app.status === 'approved';
        }
    }

    try {
        await refreshApplication();
        setInterval(() => refreshApplication().catch(() => {}), 5000);
    } catch (err) {
        if (err.status !== 401 && statusBox) {
            statusBox.className = 'form-alert error';
            statusBox.textContent = err.message || 'Could not load your host request.';
            statusBox.hidden = false;
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        statusBox.hidden = true;
        const btn = document.getElementById('hostSubmit');
        btn.disabled = true;
        const payload = Object.fromEntries(new FormData(form).entries());
        try {
            const data = await RoamitraApi.post('/host/apply', payload);
            statusBox.className = 'form-alert';
            statusBox.style.background = 'var(--color-card-blue)';
            statusBox.textContent = data.message || 'Your host request was sent to admin.';
            statusBox.hidden = false;
            form.hidden = true;
            if (data.application) {
                showExisting(data.application);
            }
        } catch (err) {
            if (err.status === 401) {
                window.location.href = RoamitraApi.page('login.html') + '?next=' + encodeURIComponent('host.html#hostApply');
                return;
            }
            statusBox.className = 'form-alert error';
            statusBox.textContent = err.message || 'Could not submit application.';
            statusBox.hidden = false;
            btn.disabled = false;
        }
    });

    function showExisting(app) {
        existing.hidden = false;
        const status = app.status || 'pending';
        existing.innerHTML = `<h3 class="h5 mb-2">Host request: ${escapeHtml(status)}</h3>
            <p class="mb-0">${escapeHtml(app.city || '')}${app.review_note ? ' — ' + escapeHtml(app.review_note) : ''}</p>
            ${status === 'pending' ? '<p class="mb-0 mt-2 text-muted">Admin can see this request on the Admin dashboard.</p>' : ''}`;
    }

    const featured = document.getElementById('hostFeatured');
    const stepHosts = (dir) => {
        if (!featured) return;
        const card = featured.querySelector('.host-feature-card');
        const amount = (card ? card.offsetWidth : 180) + 14;
        const max = featured.scrollWidth - featured.clientWidth;
        if (dir > 0 && featured.scrollLeft >= max - 8) featured.scrollTo({ left: 0, behavior: 'smooth' });
        else featured.scrollBy({ left: dir * amount, behavior: 'smooth' });
    };
    document.getElementById('hostNext')?.addEventListener('click', () => stepHosts(1));
    document.getElementById('hostPrev')?.addEventListener('click', () => stepHosts(-1));
    setInterval(() => stepHosts(1), 2800);
    setInterval(loadHosts, 30000);

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }
});
