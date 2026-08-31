document.addEventListener('DOMContentLoaded', async () => {
    const user = await RoamitraApi.me();
    if (!user) {
        window.location.href = RoamitraApi.page('login.html');
        return;
    }

    try {
        const data = await RoamitraApi.get('/profile');
        document.getElementById('profileName').textContent = data.user.full_name;
        document.getElementById('profileEmail').textContent = data.user.email;
        document.getElementById('profileInitial').textContent = (data.user.full_name || 'U').charAt(0).toUpperCase();
        document.getElementById('walletBalance').textContent =
            `${data.wallet.currency} ${Number(data.wallet.balance).toFixed(2)}`;

        const tx = data.transactions || [];
        const txBox = document.getElementById('walletTx');
        txBox.innerHTML = tx.length
            ? tx.map(t => `<li><span>${escapeHtml(t.description)}</span><strong>${t.type === 'debit' ? '−' : '+'}${t.amount}</strong></li>`).join('')
            : '<li class="text-muted">No wallet activity yet. Payments are not enabled in this app, so the ledger stays empty until credits are recorded.</li>';

        const trips = data.trips || [];
        const tripBox = document.getElementById('profileTrips');
        tripBox.innerHTML = trips.length
            ? trips.map(t => `
                <a class="profile-trip-item" href="${RoamitraApi.page('itinerary.html')}?trip=${t.id}">
                    <div class="profile-trip-info">
                        <h4>${escapeHtml(t.destination)}</h4>
                        <p>${escapeHtml(t.start_date)} → ${escapeHtml(t.end_date)} · ${escapeHtml(t.status)}${t.is_saved == 1 ? ' · saved' : ''}</p>
                    </div>
                </a>
            `).join('')
            : '<p class="text-muted">No trips yet. <a href="planner.html">Plan one</a>.</p>';

        const extra = document.getElementById('profileExtra');
        if (extra) {
            const bookings = data.bookings || [];
            const hostApp = data.host_application;
            extra.innerHTML = `
                <div class="profile-card mt-4">
                    <h3>Vehicle bookings</h3>
                    ${bookings.length ? bookings.map(b => `
                        <div class="profile-trip-item">
                            <div class="profile-trip-info">
                                <h4>${escapeHtml(b.vehicle_name)}</h4>
                                <p>${escapeHtml(b.start_date)} → ${escapeHtml(b.end_date)} · ${escapeHtml(b.days)} day(s) · $${escapeHtml(b.total)} · ${escapeHtml(b.status)}</p>
                            </div>
                        </div>
                    `).join('') : '<p class="text-muted">No rentals yet. <a href="index.html#rent-section">Book a vehicle</a>.</p>'}
                </div>
                <div class="profile-card mt-4">
                    <h3>Host status</h3>
                    <p>${data.user.role === 'host' ? 'You are a verified host.' : (hostApp ? `Application: ${escapeHtml(hostApp.status)} in ${escapeHtml(hostApp.city)}.` : 'You have not applied yet.')}</p>
                    ${data.user.role === 'customer' ? `<a class="btn-roamitra btn-roamitra-navy btn-roamitra-sm" href="${RoamitraApi.page('host.html')}">Become a host</a>` : ''}
                    ${['admin','co_admin'].includes(data.user.role) ? `<a class="btn-roamitra btn-roamitra-navy btn-roamitra-sm" href="${RoamitraApi.page('admin.html')}">Open admin</a>` : ''}
                </div>
            `;
        }
    } catch (err) {
        document.getElementById('profileAlert').textContent = err.message;
        document.getElementById('profileAlert').hidden = false;
    }

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try { await RoamitraApi.post('/auth/logout', {}); } catch (e) { /* ignore */ }
        window.location.href = RoamitraApi.page('index.html');
    });

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }
});
