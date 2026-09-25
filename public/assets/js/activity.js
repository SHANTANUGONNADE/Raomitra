document.addEventListener('DOMContentLoaded', async () => {
    const root = document.getElementById('activityList');
    if (!root || typeof RoamitraApi === 'undefined') return;
    const page = (name) => RoamitraApi.page(name);

    function stamp(value) {
        if (!value) return 0;
        const date = new Date(String(value).replace(' ', 'T'));
        return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    }

    function when(value) {
        const time = typeof value === 'number' ? value : stamp(value);
        if (!time) return '';
        const date = new Date(time);
        const mins = Math.round((Date.now() - time) / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return mins + 'm ago';
        const hours = Math.round(mins / 60);
        if (hours < 24) return hours + 'h ago';
        const days = Math.round(hours / 24);
        if (days < 7) return days + 'd ago';
        return date.toLocaleDateString();
    }

    function localItems() {
        let state = {};
        try { state = JSON.parse(localStorage.getItem('roamitra.localFeed') || '{}'); } catch (e) { return []; }
        const items = [];
        Object.values(state).forEach((entry) => {
            if (!entry) return;
            const title = entry.title || 'Local tip';
            const href = page('explore.html') + '#panel-local';
            if (entry.saved) items.push({ at: entry.savedAt || 0, icon: 'bi-bookmark-fill', title: 'Saved a local tip', body: title, href });
            if (entry.liked) items.push({ at: entry.likedAt || 0, icon: 'bi-hand-thumbs-up-fill', title: 'Liked a local tip', body: title, href });
            (entry.comments || []).forEach((comment) => {
                items.push({ at: comment.at || 0, icon: 'bi-chat', title: 'Commented on a local tip', body: comment.text || title, href });
            });
        });
        return items;
    }

    try {
        const [profile, notes] = await Promise.all([
            RoamitraApi.get('/profile'),
            RoamitraApi.get('/notifications')
        ]);
        const items = localItems();
        (profile.trips || []).forEach((trip) => {
            const saved = Number(trip.is_saved) === 1;
            items.push({
                at: stamp(trip.created_at || trip.start_date),
                icon: saved ? 'bi-bookmark-check' : 'bi-map',
                title: saved ? 'Saved a trip' : 'Planned a trip',
                body: `${trip.destination || 'Trip'} · ${trip.start_date || ''} → ${trip.end_date || ''}`,
                href: `${page('roamini.html')}?view=itinerary&trip=${trip.id}`
            });
        });
        (profile.bookings || []).forEach((booking) => {
            items.push({
                at: stamp(booking.created_at || booking.start_date),
                icon: 'bi-car-front',
                title: 'Booked ' + (booking.vehicle_name || 'a vehicle'),
                body: `${booking.location || 'Rental'} · ${booking.start_date || ''} → ${booking.end_date || ''} · ₹${booking.total || 0}`,
                href: page('rentals.html')
            });
        });
        if (profile.host_application) {
            const app = profile.host_application;
            items.push({
                at: stamp(app.created_at),
                icon: 'bi-house-door',
                title: 'Host application',
                body: `${app.city || 'Your city'} · ${app.listing_type || 'host'} · ${app.status || 'pending'}`,
                href: page('host.html')
            });
        }
        (profile.transactions || []).forEach((tx) => {
            items.push({
                at: stamp(tx.created_at),
                icon: 'bi-wallet2',
                title: 'Wallet ' + (tx.type || 'update'),
                body: `${tx.description || 'Wallet activity'} · ${tx.type === 'debit' ? '−' : '+'}₹${tx.amount}`,
                href: page('profile.html')
            });
        });
        (notes.notifications || []).forEach((note) => {
            items.push({
                at: stamp(note.created_at),
                icon: 'bi-bell',
                title: note.title || 'Update',
                body: note.body || '',
                href: note.link ? page(note.link) : page('community.html')
            });
        });
        items.sort((a, b) => (b.at || 0) - (a.at || 0));
        if (!items.length) {
            root.innerHTML = '<p class="text-muted">No activity yet. Generate an itinerary, save a trip, book a rental, or post in the community.</p>';
            return;
        }
        root.innerHTML = items.map((item) => `<a class="activity-row" href="${item.href}"><i class="bi activity-ico ${item.icon}"></i><span><strong></strong><span></span>${item.at ? '<time></time>' : ''}</span></a>`).join('');
        root.querySelectorAll('.activity-row').forEach((row, index) => {
            const item = items[index];
            row.querySelector('strong').textContent = item.title || '';
            row.querySelector('span span').textContent = item.body || '';
            const time = row.querySelector('time');
            if (time) time.textContent = when(item.at);
        });
    } catch (err) {
        if (err.status === 401) {
            window.location.replace(page('login.html') + '?next=' + encodeURIComponent('activity.html'));
            return;
        }
        root.innerHTML = '<p class="text-muted">Could not load your activity.</p>';
    }
});
