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

    const hello = document.getElementById('adminHello');
    if (hello) {
        hello.textContent = `Signed in as ${user.full_name}. Review hosts, bookings, and every member in the database.`;
    }

    let userFilter = 'all';
    let userSearch = '';
    let userSearchTimer = null;

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
                <button type="button" class="admin-stat" data-jump="hosts"><i class="bi bi-hourglass-split"></i><div><strong>${data.counts.pending_hosts}</strong><span>Pending hosts</span></div></button>
                <button type="button" class="admin-stat" data-jump="bookings"><i class="bi bi-calendar2-check"></i><div><strong>${data.counts.bookings}</strong><span>Recent bookings</span></div></button>
                <button type="button" class="admin-stat" data-jump="users" data-user-filter="all"><i class="bi bi-people"></i><div><strong>${data.counts.users}</strong><span>All users</span></div></button>
                <button type="button" class="admin-stat" data-jump="users" data-user-filter="new"><i class="bi bi-person-plus"></i><div><strong>${data.counts.new_users || 0}</strong><span>New users</span></div></button>
            `;
            document.querySelectorAll('#adminCounts [data-jump]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tab = btn.dataset.jump;
                    if (btn.dataset.userFilter) userFilter = btn.dataset.userFilter;
                    openTab(tab);
                    if (tab === 'users') loadUsers();
                });
            });
            const apps = data.applications || [];
            renderPending(apps);
            renderHosts(apps);
            renderBookings(data.bookings || []);
            await loadUsers();
        } catch (err) {
            alertBox.textContent = err.message || 'Could not load admin data.';
            alertBox.hidden = false;
        }
    };

    function openTab(name) {
        document.querySelectorAll('#adminTabs .admin-tab-btn').forEach(p => {
            p.classList.toggle('active', p.dataset.tab === name);
        });
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.hidden = tab.id !== 'tab-' + name;
        });
    }

    function statusBadge(status) {
        const key = String(status || '').toLowerCase();
        return `<span class="admin-badge ${escapeHtml(key)}">${escapeHtml(status)}</span>`;
    }

    function hostCard(a, withActions) {
        return `
            <article class="admin-host-card">
                <div>
                    <h3>${escapeHtml(a.full_name)} · ${escapeHtml(a.listing_type)}</h3>
                    <p>${escapeHtml(a.email)} · ${escapeHtml(a.phone)}</p>
                    <p>${escapeHtml(a.city)}, ${escapeHtml(a.country)} · ${statusBadge(a.status)}</p>
                    <p>${escapeHtml(a.bio || '')}</p>
                    ${a.vehicle_info ? `<p><strong>Vehicle:</strong> ${escapeHtml(a.vehicle_info)}</p>` : ''}
                </div>
                ${withActions && a.status === 'pending' ? `
                <div class="admin-actions">
                    <button type="button" class="btn-roamitra btn-roamitra-navy btn-roamitra-sm js-review" data-id="${a.id}" data-status="approved">Approve</button>
                    <button type="button" class="btn-roamitra btn-roamitra-navy btn-roamitra-sm js-review" data-id="${a.id}" data-status="rejected">Reject</button>
                </div>` : ''}
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
            box.innerHTML = `<h2>Inbox</h2><div class="admin-empty">No pending host requests. New Become a Host applications will show here.</div>`;
            return;
        }
        box.innerHTML = `<h2>Inbox · ${pending.length} waiting</h2>` + pending.map(a => hostCard(a, true)).join('');
        bindReviews(box);
    }

    function renderHosts(items) {
        const box = document.getElementById('tab-hosts');
        if (!items.length) {
            box.innerHTML = '<div class="admin-empty">No host applications yet.</div>';
            return;
        }
        box.innerHTML = items.map(a => hostCard(a, true)).join('');
        bindReviews(box);
    }

    function renderBookings(items) {
        const box = document.getElementById('tab-bookings');
        if (!items.length) {
            box.innerHTML = '<div class="admin-empty">No bookings yet.</div>';
            return;
        }
        box.innerHTML = `<div class="admin-table-wrap"><table class="table mb-0">
            <thead><tr><th>Guest</th><th>Vehicle</th><th>Dates</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>${items.map(b => `<tr>
                <td>${escapeHtml(b.full_name)}<div class="small text-muted">${escapeHtml(b.email)}</div></td>
                <td>${escapeHtml(b.vehicle_name)}<div class="small text-muted">${escapeHtml(b.location || '')}</div></td>
                <td>${escapeHtml(b.start_date)} → ${escapeHtml(b.end_date)}</td>
                <td>$${escapeHtml(b.total)}</td>
                <td>${statusBadge(b.status)}</td>
            </tr>`).join('')}</tbody></table></div>`;
    }

    function formatJoined(value) {
        const raw = String(value || '');
        const date = new Date(raw.replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) return raw;
        return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }

    function isNewJoin(value, days) {
        const date = new Date(String(value || '').replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) return false;
        return (Date.now() - date.getTime()) <= days * 86400000;
    }

    async function loadUsers() {
        const box = document.getElementById('tab-users');
        const query = new URLSearchParams({ filter: userFilter, days: '7' });
        if (userSearch) query.set('q', userSearch);
        try {
            const data = await RoamitraApi.get('/admin/users?' + query.toString());
            renderUsers(data);
        } catch (err) {
            box.innerHTML = `<div class="admin-empty">${escapeHtml(err.message || 'Could not load users.')}</div>`;
        }
    }

    function renderUsers(data) {
        const box = document.getElementById('tab-users');
        const items = data.users || [];
        const total = data.counts?.users ?? items.length;
        const fresh = data.counts?.new_users ?? 0;
        const days = data.days || 7;
        const emptyText = userFilter === 'new'
            ? `No new signups in the last ${days} days.`
            : (userSearch ? 'No users match that search.' : 'No users in the database yet.');

        box.innerHTML = `
            <div class="admin-users-toolbar">
                <div class="admin-subtabs">
                    <button type="button" class="filter-pill admin-subtab ${userFilter === 'all' ? 'active' : ''}" data-user-filter="all">All users (${total})</button>
                    <button type="button" class="filter-pill admin-subtab ${userFilter === 'new' ? 'active' : ''}" data-user-filter="new">New users (${fresh})</button>
                </div>
                <label class="admin-user-search">
                    <i class="bi bi-search"></i>
                    <input type="search" id="adminUserSearch" placeholder="Search name or email" value="${escapeHtml(userSearch)}" autocomplete="off">
                </label>
            </div>
            ${items.length ? `<div class="admin-table-wrap"><table class="table mb-0">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>${items.map(u => `<tr>
                <td>${escapeHtml(u.full_name)}${isNewJoin(u.created_at, days) ? ' <span class="admin-badge approved">new</span>' : ''}<div class="small text-muted">${escapeHtml(u.location || '')}</div></td>
                <td>${escapeHtml(u.email)}</td>
                <td>
                    <select class="form-select form-select-sm js-role admin-role" data-id="${u.id}">
                        ${['customer','host','co_admin','admin'].map(r =>
                            `<option value="${r}" ${String(u.role).toLowerCase() === r ? 'selected' : ''}>${r}</option>`
                        ).join('')}
                    </select>
                </td>
                <td>${escapeHtml(formatJoined(u.created_at))}</td>
            </tr>`).join('')}</tbody></table></div>
            <p class="admin-users-meta">Showing ${items.length} ${userFilter === 'new' ? 'new ' : ''}user${items.length === 1 ? '' : 's'} from the database.</p>` : `<div class="admin-empty">${escapeHtml(emptyText)}</div>`}`;

        box.querySelectorAll('[data-user-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                userFilter = btn.dataset.userFilter;
                loadUsers();
            });
        });
        const searchInput = document.getElementById('adminUserSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(userSearchTimer);
                userSearchTimer = setTimeout(() => {
                    userSearch = searchInput.value.trim();
                    loadUsers();
                }, 250);
            });
        }
        box.querySelectorAll('.js-role').forEach(sel => {
            sel.addEventListener('change', async () => {
                try {
                    await RoamitraApi.post('/admin/users/role', {
                        user_id: Number(sel.dataset.id),
                        role: sel.value
                    });
                    await load();
                } catch (err) {
                    alertBox.textContent = err.message || 'Could not update role.';
                    alertBox.hidden = false;
                    await load();
                }
            });
        });
    }

    document.getElementById('adminTabs').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;
        openTab(btn.dataset.tab);
        if (btn.dataset.tab === 'users') loadUsers();
    });

    await load();
    setInterval(() => {
        const typing = document.activeElement && document.activeElement.id === 'adminUserSearch';
        if (!typing) load();
    }, 20000);
});
