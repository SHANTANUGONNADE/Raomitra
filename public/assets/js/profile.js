document.addEventListener('DOMContentLoaded', async () => {
    const user = await RoamitraApi.me();
    if (!user) {
        window.location.href = RoamitraApi.page('login.html') + '?next=profile.html';
        return;
    }

    const state = {
        avatar: user.avatar_url || null,
        cover: user.cover_url || null,
        name: user.full_name || '',
        bio: user.bio || '',
        location: user.location || '',
        email: user.email || '',
        role: String(user.role || 'customer').toLowerCase()
    };

    const coverEl = document.getElementById('profileCover');
    const avatarEl = document.getElementById('profileAvatar');
    const form = document.getElementById('profileForm');
    const alertBox = document.getElementById('profileAlert');
    const successBox = document.getElementById('profileSuccess');
    renderHeader();

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    function roleLabel(role) {
        return ({
            admin: 'Admin',
            co_admin: 'Co-admin',
            host: 'Verified host',
            customer: 'Traveler'
        })[role] || 'Member';
    }

    function applyCover(value) {
        coverEl.style.backgroundImage = '';
        coverEl.style.background = '';
        if (!value) {
            coverEl.style.background = 'linear-gradient(135deg,#0B3D2E 0%,#1A8A58 45%,#76D885 100%)';
            return;
        }
        if (String(value).startsWith('linear-gradient(')) {
            coverEl.style.background = value;
            return;
        }
        const src = RoamitraApi.mediaUrl(value);
        coverEl.style.backgroundImage = `linear-gradient(180deg,rgba(5,22,53,.18),rgba(5,22,53,.45)), url("${src}")`;
        coverEl.style.backgroundSize = 'cover';
        coverEl.style.backgroundPosition = 'center';
    }

    function applyAvatar(value, name) {
        const initial = (name || 'U').trim().charAt(0).toUpperCase();
        if (value) {
            avatarEl.style.backgroundImage = `url("${RoamitraApi.mediaUrl(value)}")`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.style.backgroundPosition = 'center';
            avatarEl.textContent = '';
            avatarEl.classList.add('has-photo');
            return;
        }
        avatarEl.style.backgroundImage = '';
        avatarEl.classList.remove('has-photo');
        avatarEl.textContent = initial;
    }

    function renderHeader() {
        applyCover(state.cover);
        applyAvatar(state.avatar, state.name);
        document.getElementById('profileName').textContent = state.name || 'Your profile';
        document.getElementById('profileRole').textContent = roleLabel(state.role);
        document.getElementById('profileRole').dataset.role = state.role;
        const bits = [state.location, state.email].filter(Boolean);
        document.getElementById('profileMeta').innerHTML = bits.map(escapeHtml).join(' · ');
        document.getElementById('profileBio').textContent = state.bio || 'Add a short intro so travelers know who you are.';
        const loc = document.getElementById('aboutLocation');
        const mail = document.getElementById('aboutEmail');
        const role = document.getElementById('aboutRole');
        if (loc) loc.textContent = state.location || 'Add your city';
        if (mail) mail.textContent = state.email;
        if (role) role.textContent = roleLabel(state.role);
        document.getElementById('fullName').value = state.name;
        document.getElementById('userLocation').value = state.location;
        document.getElementById('userBio').value = state.bio;
    }

    function flash(ok, message) {
        alertBox.hidden = true;
        successBox.hidden = true;
        const box = ok ? successBox : alertBox;
        box.textContent = message;
        box.hidden = false;
    }

    function compressImage(file, maxW, maxH, quality) {
        return new Promise((resolve, reject) => {
            if (file.size > 8 * 1024 * 1024) {
                reject(new Error('Choose a photo under 8 MB.'));
                return;
            }
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                let scale = Math.min(maxW / img.width, maxH / img.height, 1);
                let canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                let out = canvas.toDataURL('image/jpeg', quality);
                let q = quality;
                while (out.length > 700000 && q > 0.45) {
                    q -= 0.12;
                    out = canvas.toDataURL('image/jpeg', q);
                }
                resolve(out);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Could not read that image.'));
            };
            img.src = url;
        });
    }

    async function saveProfile(extra = {}) {
        const payload = {
            full_name: document.getElementById('fullName').value.trim() || state.name,
            bio: document.getElementById('userBio').value.trim(),
            location: document.getElementById('userLocation').value.trim()
        };
        if (Object.prototype.hasOwnProperty.call(extra, 'avatar_url')) payload.avatar_url = extra.avatar_url;
        if (Object.prototype.hasOwnProperty.call(extra, 'cover_url')) payload.cover_url = extra.cover_url;
        const data = await RoamitraApi.post('/profile', payload);
        const next = data.user || {};
        state.avatar = next.avatar_url || null;
        state.cover = next.cover_url || null;
        state.name = next.full_name || payload.full_name;
        state.bio = next.bio || '';
        state.location = next.location || '';
        if (window.RoamitraNav) RoamitraNav.user = next;
        if (window.RoamitraNav && RoamitraNav.renderActions) RoamitraNav.renderActions();
        renderHeader();
        flash(true, data.message || 'Profile saved.');
    }

    try {
        const data = await RoamitraApi.get('/profile');
        const u = data.user || user;
        state.avatar = u.avatar_url || null;
        state.cover = u.cover_url || null;
        state.name = u.full_name || '';
        state.bio = u.bio || '';
        state.location = u.location || '';
        state.email = u.email || '';
        state.role = String(u.role || 'customer').toLowerCase();
        renderHeader();

        const trips = data.trips || [];
        const bookings = data.bookings || [];
        document.getElementById('profileStats').innerHTML = `
            <div class="profile-stat"><strong>${trips.length}</strong><span>Trips</span></div>
            <div class="profile-stat"><strong>${bookings.length}</strong><span>Rentals</span></div>
            <div class="profile-stat"><strong>${(data.wallet && data.wallet.currency) || 'USD'} ${Number(data.wallet?.balance || 0).toFixed(0)}</strong><span>Wallet</span></div>
            <div class="profile-stat"><strong>${roleLabel(state.role)}</strong><span>Role</span></div>
        `;
        const shortcuts = document.getElementById('profileShortcuts');
        if (shortcuts) {
            const staff = ['admin', 'co_admin'].includes(state.role);
            shortcuts.innerHTML = `
                <a class="profile-shortcut" href="${RoamitraApi.page('planner.html')}"><i class="bi bi-map"></i><span><strong>Plan trip</strong><span>Build an itinerary</span></span></a>
                <a class="profile-shortcut" href="${RoamitraApi.page('community.html')}"><i class="bi bi-people"></i><span><strong>Community</strong><span>Ask locals</span></span></a>
                <a class="profile-shortcut" href="${RoamitraApi.page('translator.html')}"><i class="bi bi-translate"></i><span><strong>Translator</strong><span>Talk anywhere</span></span></a>
                <a class="profile-shortcut" href="${RoamitraApi.page(staff ? 'admin.html' : 'host.html')}"><i class="bi bi-${staff ? 'shield-check' : 'house-heart'}"></i><span><strong>${staff ? 'Admin' : 'Host'}</strong><span>${staff ? 'Staff dashboard' : 'Earn as a local'}</span></span></a>
            `;
        }
        document.getElementById('walletBalance').textContent =
            `${data.wallet.currency} ${Number(data.wallet.balance).toFixed(2)}`;

        const tx = data.transactions || [];
        const txBox = document.getElementById('walletTx');
        txBox.innerHTML = tx.length
            ? tx.map(t => `<li><span>${escapeHtml(t.description)}</span><strong>${t.type === 'debit' ? '−' : '+'}${t.amount}</strong></li>`).join('')
            : '<li class="text-muted">No wallet activity yet.</li>';

        const tripBox = document.getElementById('profileTrips');
        tripBox.innerHTML = trips.length
            ? trips.map(t => `
                <a class="profile-trip-item" href="${RoamitraApi.page('itinerary.html')}?trip=${t.id}">
                    <div class="profile-trip-mark">${escapeHtml((t.destination || '?').charAt(0).toUpperCase())}</div>
                    <div class="profile-trip-info">
                        <h4>${escapeHtml(t.destination)}</h4>
                        <p>${escapeHtml(t.start_date)} → ${escapeHtml(t.end_date)} · ${escapeHtml(t.status)}${t.is_saved == 1 ? ' · saved' : ''}</p>
                    </div>
                    <i class="bi bi-chevron-right ms-auto"></i>
                </a>
            `).join('')
            : '<div class="profile-empty">No trips yet. Plan one and it will land here with dates and status.</div>';

        const extra = document.getElementById('profileExtra');
        const hostApp = data.host_application;
        extra.innerHTML = `
            <div class="profile-card mt-4">
                <div class="profile-card-head">
                    <h3>Vehicle bookings</h3>
                    <a class="profile-card-link" href="${RoamitraApi.page('community.html')}#rent-section">Rent</a>
                </div>
                ${bookings.length ? bookings.map(b => `
                    <div class="profile-trip-item">
                        <div class="profile-trip-mark">${escapeHtml((b.vehicle_name || '?').charAt(0).toUpperCase())}</div>
                        <div class="profile-trip-info">
                            <h4>${escapeHtml(b.vehicle_name)}</h4>
                            <p>${escapeHtml(b.start_date)} → ${escapeHtml(b.end_date)} · ${escapeHtml(b.days)} day(s) · $${escapeHtml(b.total)} · ${escapeHtml(b.status)}</p>
                        </div>
                    </div>
                `).join('') : '<div class="profile-empty">No rentals yet. Browse scooters, bikes, and cars from locals.</div>'}
            </div>
            <div class="profile-card mt-4 ${state.role === 'customer' ? 'profile-host-banner' : ''}">
                <h3>Host status</h3>
                <p>${state.role === 'host' ? 'You are a verified host.' : (hostApp ? `Application: ${escapeHtml(hostApp.status)} in ${escapeHtml(hostApp.city)}.` : 'Share your city, earn as a host, and help travelers feel local.')}</p>
                ${state.role === 'customer' ? `<a class="btn-roamitra btn-roamitra-navy btn-roamitra-sm" href="${RoamitraApi.page('host.html')}">Become a host</a>` : ''}
                ${['admin','co_admin'].includes(state.role) ? `<a class="btn-roamitra btn-roamitra-navy btn-roamitra-sm" href="${RoamitraApi.page('admin.html')}">Open admin</a>` : ''}
            </div>
        `;
    } catch (err) {
        flash(false, err.message || 'Could not load profile.');
        renderHeader();
    }

    document.getElementById('editToggle').addEventListener('click', () => {
        form.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('cancelEdit').addEventListener('click', () => {
        form.hidden = true;
        renderHeader();
    });
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('saveProfile');
        btn.disabled = true;
        try {
            await saveProfile();
            form.hidden = true;
        } catch (err) {
            flash(false, err.message || 'Could not save profile.');
        } finally {
            btn.disabled = false;
        }
    });

    document.getElementById('avatarFile').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
            const dataUrl = await compressImage(file, 360, 360, 0.72);
            applyAvatar(dataUrl, state.name);
            await saveProfile({ avatar_url: dataUrl });
        } catch (err) {
            flash(false, err.message || 'Could not update photo.');
        }
    });

    document.getElementById('coverFile').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
            const dataUrl = await compressImage(file, 1280, 520, 0.68);
            applyCover(dataUrl);
            await saveProfile({ cover_url: dataUrl });
        } catch (err) {
            flash(false, err.message || 'Could not update cover.');
        }
    });

    document.getElementById('coverPresets').addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-preset]');
        if (!btn) return;
        try {
            await saveProfile({ cover_url: 'preset:' + btn.dataset.preset });
        } catch (err) {
            flash(false, err.message || 'Could not update cover.');
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try { await RoamitraApi.post('/auth/logout', {}); } catch (e) { /* ignore */ }
        window.location.href = RoamitraApi.page('explore.html');
    });
});
