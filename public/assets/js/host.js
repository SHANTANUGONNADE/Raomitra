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

    try {
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
            if (app.status === 'pending') {
                form.hidden = true;
            }
        }
    } catch (err) {
        if (err.status === 401) {
            const next = (location.pathname.split('/').pop() || 'host.html') + location.search;
            window.location.replace(RoamitraApi.page('login.html') + '?next=' + encodeURIComponent(next));
            return;
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

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }
});
