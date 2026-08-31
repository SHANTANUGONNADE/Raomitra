document.addEventListener('DOMContentLoaded', async () => {
    const gate = document.getElementById('adminGate');
    const app = document.getElementById('adminApp');
    const alertBox = document.getElementById('adminAlert');
    const loginLink = document.getElementById('adminLoginLink');
    loginLink.href = RoamitraApi.page('login.html') + '?mode=admin';

    const user = await RoamitraApi.me();
    if (!user) {
        window.location.replace(RoamitraApi.page('login.html') + '?mode=admin');
        return;
    }
    if (!['admin', 'co_admin'].includes(user.role)) {
        gate.hidden = false;
        gate.querySelector('p').textContent = 'This dashboard is for admin staff only. Sign in with an admin account.';
        return;
    }

    const escapeHtml = (text) => {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    };

    const load = async () => {
        alertBox.hidden = true;
        try {
            const data = await RoamitraApi.get('/admin/overview');
            gate.hidden = true;
            app.hidden = false;
            document.getElementById('adminCounts').innerHTML = `
                <div class="col-md-4"><div class="planner-card"><div class="small text-muted">Pending hosts</div><strong>${data.counts.pending_hosts}</strong></div></div>
                <div class="col-md-4"><div class="planner-card"><div class="small text-muted">Recent bookings</div><strong>${data.counts.bookings}</strong></div></div>
                <div class="col-md-4"><div class="planner-card"><div class="small text-muted">Users</div><strong>${data.counts.users}</strong></div></div>
            `;
            const apps = data.applications || [];
            renderPending(apps);
            renderHosts(apps);
            renderBookings(data.bookings || []);
            renderUsers(data.users || []);
        } catch (err) {
            alertBox.textContent = err.message || 'Could not load admin data.';
            alertBox.hidden = false;
        }
    };

    function statusBadge(status) {
        const map = { pending: 'warning', approved: 'success', rejected: 'danger' };
        const tone = map[status] || 'secondary';
        return `<span class="badge text-bg-${tone}">${escapeHtml(status)}</span>`;
    }

    function hostCard(a, withActions) {
        return `
            <article class="planner-card mb-3">
                <div class="d-flex justify-content-between gap-2 flex-wrap">
                    <div>
                        <h3 class="h5 mb-1">${escapeHtml(a.full_name)} · ${escapeHtml(a.listing_type)}</h3>
                        <p class="mb-1 text-muted">${escapeHtml(a.email)} · ${escapeHtml(a.phone)}</p>
                        <p class="mb-1">${escapeHtml(a.city)}, ${escapeHtml(a.country)} · ${statusBadge(a.status)}</p>
                        <p class="mb-0">${escapeHtml(a.bio || '')}</p>
                        ${a.vehicle_info ? `<p class="mb-0 mt-2"><strong>Vehicle:</strong> ${escapeHtml(a.vehicle_info)}</p>` : ''}
                    </div>
                    ${withActions && a.status === 'pending' ? `
                    <div class="d-flex gap-2 align-items-start">
                        <button type="button" class="btn-roamitra btn-roamitra-primary btn-roamitra-sm js-review" data-id="${a.id}" data-status="approved">Approve</button>
                        <button type="button" class="btn-roamitra btn-roamitra-outline btn-roamitra-sm js-review" data-id="${a.id}" data-status="rejected">Reject</button>
                    </div>` : ''}
                </div>
            </article>`;
    }

    function bindReviews(root) {
        root.querySelectorAll('.js-review').forEach(btn => {
            btn.addEventListener('click', async () => {
                const note = btn.dataset.status === 'rejected'
                    ? (window.prompt('Optional note for the applicant:') || '')
                    : '';
                try {
                    await RoamitraApi.post('/admin/hosts/review', {
                        id: Number(btn.dataset.id),
                        status: btn.dataset.status,
                        note
                    });
                    await load();
                } catch (err) {
                    alertBox.textContent = err.message;
                    alertBox.hidden = false;
                }
            });
        });
    }

    function renderPending(items) {
        const box = document.getElementById('pendingHosts');
        const pending = items.filter(a => a.status === 'pending');
        if (!pending.length) {
            box.innerHTML = `<div class="planner-card"><h2 class="h5 mb-2">Pending host requests</h2>
                <p class="mb-0 text-muted">New Become a Host requests from members will show here for approval.</p></div>`;
            return;
        }
        box.innerHTML = `<h2 class="h5 mb-3">Pending host requests (${pending.length})</h2>`
            + pending.map(a => hostCard(a, true)).join('');
        bindReviews(box);
    }

    function renderHosts(items) {
        const box = document.getElementById('tab-hosts');
        if (!items.length) {
            box.innerHTML = '<p class="text-muted">No host applications yet.</p>';
            return;
        }
        box.innerHTML = items.map(a => hostCard(a, true)).join('');
        bindReviews(box);
    }

    function renderBookings(items) {
        const box = document.getElementById('tab-bookings');
        if (!items.length) {
            box.innerHTML = '<p class="text-muted">No bookings yet.</p>';
            return;
        }
        box.innerHTML = `<div class="table-responsive planner-card"><table class="table mb-0">
            <thead><tr><th>Guest</th><th>Vehicle</th><th>Dates</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>${items.map(b => `<tr>
                <td>${escapeHtml(b.full_name)}<div class="small text-muted">${escapeHtml(b.email)}</div></td>
                <td>${escapeHtml(b.vehicle_name)}<div class="small text-muted">${escapeHtml(b.location || '')}</div></td>
                <td>${escapeHtml(b.start_date)} → ${escapeHtml(b.end_date)}</td>
                <td>$${escapeHtml(b.total)}</td>
                <td>${escapeHtml(b.status)}</td>
            </tr>`).join('')}</tbody></table></div>`;
    }

    function renderUsers(items) {
        const box = document.getElementById('tab-users');
        box.innerHTML = `<div class="table-responsive planner-card"><table class="table mb-0">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>${items.map(u => `<tr>
                <td>${escapeHtml(u.full_name)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${escapeHtml(u.role)}</td>
                <td>${escapeHtml(u.created_at)}</td>
            </tr>`).join('')}</tbody></table></div>`;
    }

    document.getElementById('adminTabs').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;
        document.querySelectorAll('#adminTabs .filter-pill').forEach(p => p.classList.toggle('active', p === btn));
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.hidden = tab.id !== 'tab-' + btn.dataset.tab;
        });
    });

    await load();
    setInterval(load, 20000);
});
