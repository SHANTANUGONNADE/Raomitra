/**
 * Shared navbar: consistent header, auth gate, notifications, AI launcher.
 */
const RoamitraNav = {
    user: null,
    chatTimer: null,
    previousMessageUnread: null,
    protectedPages: ['translator', 'profile', 'itinerary', 'booking', 'roamini', 'activity'],

    applyBranding() {
        const logoSrc = RoamitraApi.basePath() + 'assets/images/logo.png';
        const botSrc = RoamitraApi.basePath() + 'assets/images/ai-bot.jpeg';
        document.querySelectorAll('.roamitra-logo-icon').forEach(el => {
            const img = document.createElement('img');
            img.src = logoSrc;
            img.alt = 'Roamitra';
            img.className = 'roamitra-logo-img';
            el.replaceWith(img);
        });
        document.querySelectorAll('.ai-assistant-fab').forEach(btn => {
            if (btn.querySelector('img')) return;
            btn.innerHTML = `<img src="${botSrc}" alt="" class="ai-bot-photo">`;
        });
        document.querySelectorAll('.ai-assistant-avatar, .ai-message.bot .ai-message-avatar').forEach(el => {
            if (el.querySelector('img')) return;
            el.innerHTML = `<img src="${botSrc}" alt="" class="ai-bot-photo">`;
        });
    },

    async init() {
        this.renderShell();
        this.applyBranding();
        this.user = await RoamitraApi.me();
        if (!this.allowPage()) {
            return;
        }
        this.renderActions();
        this.setActive();
        if (this.user) {
            await this.refreshNotifications();
            setInterval(() => this.refreshNotifications(), 5000);
        }
        if (typeof RoamitraAI !== 'undefined') {
            RoamitraAI.mount();
        }
    },

    allowPage() {
        const page = document.body.dataset.page;
        if (!this.protectedPages.includes(page)) {
            return true;
        }
        if (this.user) {
            return true;
        }
        const next = (location.pathname.split('/').pop() || 'explore.html') + location.search;
        window.location.replace(RoamitraApi.page('login.html') + '?next=' + encodeURIComponent(next));
        return false;
    },

    renderShell() {
        const nav = document.querySelector('.roamitra-navbar');
        if (!nav) return;
        const base = RoamitraApi.basePath();
        nav.innerHTML = `
            <div class="container navbar-glass">
                <div class="navbar-row">
                    <a href="${base}explore.html" class="navbar-brand">
                        <img src="${base}assets/images/logo.png" alt="Roamitra" class="roamitra-logo-img">
                        <span class="roamitra-logo-text">Roamitra</span>
                    </a>
                    <ul class="roamitra-nav-links">
                        <li><a href="${base}explore.html" class="nav-link" data-nav="explore"><i class="bi bi-compass"></i> Explore</a></li>
                        <li><a href="${base}community.html" class="nav-link" data-nav="community"><i class="bi bi-people"></i> Community</a></li>
                        <li><a href="${base}roamini.html" class="nav-link" data-nav="roamini"><i class="bi bi-stars"></i> Roamini AI</a></li>
                    </ul>
                    <button type="button" class="roamitra-navbar-toggler" aria-label="Open menu" aria-expanded="false">
                        <i class="bi bi-list"></i>
                    </button>
                    <div class="navbar-end">
                        <div class="roamitra-nav-actions"></div>
                    </div>
                </div>
            </div>
            <div class="roamitra-tabbar" role="navigation" aria-label="Primary">
                <div class="tab-account"></div>
                <div class="tab-main">
                    <a href="${base}explore.html" class="tab-item" data-nav="explore"><span class="tab-icon"><i class="bi bi-compass"></i></span><span class="tab-label">Explore</span></a>
                    <a href="${base}community.html" class="tab-item" data-nav="community"><span class="tab-icon"><i class="bi bi-people"></i></span><span class="tab-label">Community</span></a>
                    <a href="${base}roamini.html" class="tab-item" data-nav="roamini"><span class="tab-icon"><i class="bi bi-stars"></i></span><span class="tab-label">Roamini</span></a>
                </div>
            </div>
        `;
        const toggler = nav.querySelector('.roamitra-navbar-toggler');
        if (toggler) {
            toggler.addEventListener('click', (event) => {
                event.stopPropagation();
                const open = nav.classList.toggle('is-open');
                toggler.setAttribute('aria-expanded', open ? 'true' : 'false');
                toggler.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
                toggler.innerHTML = open ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-list"></i>';
            });
            const closeMenu = () => {
                if (!nav.classList.contains('is-open')) return;
                nav.classList.remove('is-open');
                toggler.setAttribute('aria-expanded', 'false');
                toggler.setAttribute('aria-label', 'Open menu');
                toggler.innerHTML = '<i class="bi bi-list"></i>';
            };
            document.addEventListener('click', (event) => {
                if (!nav.classList.contains('is-open')) return;
                if (toggler.contains(event.target) || nav.contains(event.target)) return;
                closeMenu();
            });
        }
    },

    setActive() {
        const page = document.body.dataset.page;
        if (!page) return;
        document.querySelectorAll('[data-nav]').forEach(link => {
            link.classList.toggle('active', link.dataset.nav === page);
        });
    },

    renderActions() {
        const desktop = document.querySelector('.roamitra-nav-actions');
        const mobileRow = document.querySelector('.mobile-auth-row');
        if (desktop) {
            desktop.innerHTML = '';
            desktop.appendChild(this.themeButton());
            if (this.user) {
                if (['admin', 'co_admin'].includes(this.user.role)) {
                    desktop.insertAdjacentHTML('beforeend', `<a href="${RoamitraApi.page('admin.html')}" class="btn-roamitra btn-roamitra-navy btn-roamitra-sm nav-keep nav-admin" aria-label="Admin"><i class="bi bi-shield-lock"></i><span>Admin</span></a>`);
                } else if (this.user.role === 'customer') {
                    desktop.insertAdjacentHTML('beforeend', `<a href="${RoamitraApi.page('host.html')}" class="btn-roamitra btn-roamitra-ghost">Become a host</a>`);
                }
                desktop.appendChild(this.chatButton());
                desktop.appendChild(this.bellButton());
                desktop.appendChild(this.profileButton());
                if (document.body.dataset.page === 'profile') {
                    desktop.insertAdjacentHTML('beforeend', `<button type="button" class="btn-roamitra btn-roamitra-navy btn-roamitra-sm nav-keep js-logout">Log out</button>`);
                }
            } else {
                desktop.insertAdjacentHTML('beforeend', `
                    <a href="${RoamitraApi.page('host.html')}" class="btn-roamitra btn-roamitra-ghost">Become a host</a>
                    <a href="${RoamitraApi.page('login.html')}" class="btn-roamitra btn-roamitra-ghost">Log in</a>
                    <a href="${RoamitraApi.page('signup.html')}" class="btn-roamitra btn-roamitra-primary">Sign up</a>
                `);
            }
        }
        const tabAccount = document.querySelector('.tab-account');
        if (tabAccount) {
            if (this.user) {
                const staff = ['admin', 'co_admin'].includes(this.user.role);
                tabAccount.innerHTML = `
                    ${staff ? `<a href="${RoamitraApi.page('admin.html')}" data-nav="admin"><i class="bi bi-shield-lock"></i><span>Admin</span></a>` : ''}
                    ${this.user.role === 'customer' ? `<a href="${RoamitraApi.page('host.html')}"><i class="bi bi-house-door"></i><span>Host</span></a>` : ''}
                    <button type="button" class="js-logout"><i class="bi bi-box-arrow-right"></i><span>Log out</span></button>
                `;
            } else {
                tabAccount.innerHTML = `
                    <a href="${RoamitraApi.page('host.html')}"><i class="bi bi-house-door"></i><span>Host</span></a>
                    <a href="${RoamitraApi.page('login.html')}"><i class="bi bi-box-arrow-in-right"></i><span>Log in</span></a>
                    <a href="${RoamitraApi.page('signup.html')}"><i class="bi bi-person-plus"></i><span>Sign up</span></a>
                `;
            }
        }
        if (mobileRow) {
            if (this.user) {
                mobileRow.innerHTML = `
                    <a href="${RoamitraApi.page('profile.html')}" class="btn-roamitra btn-roamitra-navy flex-fill">Profile</a>
                    ${this.user.role === 'customer' ? `<a href="${RoamitraApi.page('host.html')}" class="btn-roamitra btn-roamitra-outline flex-fill">Become a host</a>` : ''}
                    ${['admin','co_admin'].includes(this.user.role) ? `<a href="${RoamitraApi.page('admin.html')}" class="btn-roamitra btn-roamitra-navy flex-fill nav-keep">Admin</a>` : ''}
                    <button type="button" class="btn-roamitra btn-roamitra-navy flex-fill nav-keep js-logout">Log out</button>
                `;
            } else {
                mobileRow.innerHTML = `
                    <a href="${RoamitraApi.page('host.html')}" class="btn-roamitra btn-roamitra-outline flex-fill">Become a host</a>
                    <a href="${RoamitraApi.page('login.html')}" class="btn-roamitra btn-roamitra-outline flex-fill">Log in</a>
                    <a href="${RoamitraApi.page('signup.html')}" class="btn-roamitra btn-roamitra-primary flex-fill">Sign up</a>
                `;
            }
            mobileRow.prepend(this.themeButton());
        }
        this.syncYouTab();
        document.querySelectorAll('.js-logout').forEach(btn => {
            btn.addEventListener('click', async () => {
                try { await RoamitraApi.post('/auth/logout', {}); } catch (e) { /* ignore */ }
                window.location.href = RoamitraApi.page('explore.html');
            });
        });
    },

    syncYouTab() {
        const you = document.querySelector('.tab-you');
        if (!you) return;
        const avatar = you.querySelector('.tab-you-avatar');
        if (!this.user) {
            you.href = RoamitraApi.page('login.html');
            if (avatar) avatar.textContent = 'U';
            return;
        }
        you.href = RoamitraApi.page('profile.html');
        const initial = (this.user.full_name || 'U').trim().charAt(0).toUpperCase();
        if (!avatar) return;
        if (this.user.avatar_url) {
            avatar.innerHTML = `<img src="${this.escape(RoamitraApi.mediaUrl(this.user.avatar_url))}" alt="">`;
        } else {
            avatar.textContent = initial;
        }
    },

    paintActivityBadge(unread) {
        const tabBadge = document.getElementById('tabActivityBadge');
        if (!tabBadge) return;
        const count = Number(unread) || 0;
        tabBadge.hidden = count === 0;
        tabBadge.textContent = count > 99 ? '99+' : String(count);
    },

    themeButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'theme-toggle';
        btn.setAttribute('aria-label', 'Toggle dark mode');
        const sync = () => {
            const dark = (window.RoamitraTheme ? RoamitraTheme.current() : document.documentElement.getAttribute('data-theme')) === 'dark';
            btn.innerHTML = dark ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon"></i>';
        };
        sync();
        btn.addEventListener('click', () => {
            if (window.RoamitraTheme) RoamitraTheme.toggle();
            else {
                const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('roamitra-theme', next);
            }
            sync();
        });
        return btn;
    },

    bellButton() {
        const wrap = document.createElement('div');
        wrap.className = 'nav-notify-wrap';
        wrap.innerHTML = `
            <button type="button" class="nav-icon-btn" id="notifyBell" aria-label="Notifications" aria-expanded="false">
                <i class="bi bi-bell"></i>
                <span class="nav-unread-dot" id="notifyDot" hidden></span>
            </button>
            <div class="notify-panel" id="notifyPanel" hidden>
                <div class="notify-panel-header">
                    <strong>Notifications</strong>
                    <button type="button" class="notify-mark-all" id="notifyMarkAll">Mark all read</button>
                </div>
                <div class="notify-panel-body" id="notifyBody">
                    <p class="notify-empty">Loading…</p>
                </div>
            </div>
        `;
        wrap.querySelector('#notifyBell').addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = wrap.querySelector('#notifyPanel');
            const open = panel.hidden;
            panel.hidden = !open;
            wrap.querySelector('#notifyBell').setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) this.refreshNotifications();
        });
        wrap.querySelector('#notifyMarkAll').addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await RoamitraApi.post('/notifications/read-all', {});
                await this.refreshNotifications();
            } catch (err) { /* ignore */ }
        });
        document.addEventListener('click', () => {
            wrap.querySelector('#notifyPanel').hidden = true;
        });
        wrap.querySelector('#notifyPanel').addEventListener('click', (e) => e.stopPropagation());
        return wrap;
    },

    chatButton() {
        const wrap = document.createElement('div');
        wrap.className = 'nav-chat-wrap';
        wrap.innerHTML = `
            <button type="button" class="nav-icon-btn" id="chatNavButton" aria-label="Messages" aria-expanded="false">
                <i class="bi bi-chat-dots"></i>
                <span class="nav-unread-dot" id="chatNavDot" hidden></span>
            </button>
            <div class="nav-chat-panel" id="chatNavPanel" hidden>
                <div class="nav-chat-header"><strong>Messages</strong></div>
                <div class="nav-chat-body" id="chatNavBody"><p class="notify-empty">Loading…</p></div>
            </div>`;
        const button = wrap.querySelector('#chatNavButton');
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const panel = wrap.querySelector('#chatNavPanel');
            panel.hidden = !panel.hidden;
            button.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
            if (!panel.hidden) {
                this.refreshChats();
                this.markMessageNotificationsRead();
            }
        });
        wrap.querySelector('#chatNavPanel').addEventListener('click', (event) => event.stopPropagation());
        document.addEventListener('click', () => { wrap.querySelector('#chatNavPanel').hidden = true; });
        return wrap;
    },

    async refreshChats() {
        const body = document.getElementById('chatNavBody');
        if (!body) return;
        try {
            const data = await RoamitraApi.get('/connections');
            const connections = (data.connections || []).filter((item) => item.status === 'accepted');
            if (!connections.length) {
                body.innerHTML = '<p class="notify-empty">No accepted connections yet.</p>';
                return;
            }
            body.innerHTML = connections.map((item) =>
                `<button type="button" class="nav-chat-person" data-chat-person="${Number(item.person_id)}" data-chat-name="${this.escape(item.full_name || 'Traveler')}">
                    <span class="nav-chat-avatar">${this.escape((item.full_name || 'T').trim().charAt(0).toUpperCase())}</span>
                    <span><strong>${this.escape(item.full_name || 'Traveler')}</strong><small>${this.escape(item.location || 'Connected traveler')}</small></span>
                </button>`
            ).join('');
            body.querySelectorAll('[data-chat-person]').forEach((item) => {
                item.addEventListener('click', () => this.openNavbarChat(Number(item.dataset.chatPerson), item.dataset.chatName));
            });
        } catch (error) {
            body.innerHTML = `<p class="notify-empty">${this.escape(error.message)}</p>`;
        }
    },

    async openNavbarChat(personId, name) {
        const body = document.getElementById('chatNavBody');
        if (!body) return;
        if (this.chatTimer) clearInterval(this.chatTimer);
        await this.markMessageNotificationsRead();
        body.innerHTML = `
            <div class="nav-chat-conversation">
                <button type="button" class="nav-chat-back" id="chatNavBack"><i class="bi bi-arrow-left"></i> Messages</button>
                <strong class="nav-chat-conversation-title">Chat with ${this.escape(name)}</strong>
                <div class="nav-chat-messages" id="navChatMessages"></div>
                <form id="navChatForm" class="nav-chat-compose">
                    <input name="body" maxlength="2000" placeholder="Write a message..." required>
                    <button type="submit" aria-label="Send"><i class="bi bi-send"></i></button>
                </form>
            </div>`;
        const load = async () => {
            const messages = document.getElementById('navChatMessages');
            if (!messages) return;
            const data = await RoamitraApi.get('/messages?user_id=' + personId);
            messages.innerHTML = (data.messages || []).map((message) =>
                `<div class="nav-chat-bubble ${Number(message.sender_id) === personId ? 'incoming' : 'outgoing'}">${this.escape(message.body)}<time>${this.relativeTime(message.created_at)}</time></div>`
            ).join('') || '<p class="notify-empty">Start the conversation.</p>';
            messages.scrollTop = messages.scrollHeight;
        };
        await load();
        document.getElementById('chatNavBack')?.addEventListener('click', () => {
            if (this.chatTimer) clearInterval(this.chatTimer);
            this.chatTimer = null;
            this.refreshChats();
        });
        document.getElementById('navChatForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const input = form.elements.body;
            if (!input.value.trim()) return;
            await RoamitraApi.post('/messages', { user_id: personId, body: input.value.trim() });
            input.value = '';
            await load();
        });
        this.chatTimer = setInterval(() => load().catch(() => {}), 5000);
    },

    async markMessageNotificationsRead() {
        try {
            const data = await RoamitraApi.get('/notifications');
            const pending = (data.notifications || []).filter((item) =>
                item.type === 'message' && !(item.is_read == 1 || item.is_read === true)
            );
            await Promise.all(pending.map((item) => RoamitraApi.post('/notifications/' + item.id + '/read', {})));
            this.previousMessageUnread = 0;
            this.paintMessageBadge(0);
            await this.refreshNotifications();
        } catch (error) {
            // The chat remains usable if notification state cannot be updated.
        }
    },

    profileButton() {
        const a = document.createElement('a');
        a.href = RoamitraApi.page('profile.html');
        a.className = 'nav-profile-btn';
        a.setAttribute('aria-label', 'Profile');
        const initial = (this.user.full_name || 'U').trim().charAt(0).toUpperCase();
        if (this.user.avatar_url) {
            a.innerHTML = `<img class="nav-profile-avatar has-photo" src="${this.escape(RoamitraApi.mediaUrl(this.user.avatar_url))}" alt="">`;
        } else {
            a.innerHTML = `<span class="nav-profile-avatar">${this.escape(initial)}</span>`;
        }
        return a;
    },

    typeLabel(type) {
        return ({
            itinerary: 'Itinerary',
            saved_trip: 'Saved trip',
            community: 'Community',
            community_update: 'Community update',
            booking: 'Booking',
            host: 'Host',
            connection: 'Connection',
            message: 'Message'
        })[type] || type;
    },

    relativeTime(value) {
        if (!value) return '';
        const date = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) return String(value);
        const diff = Date.now() - date.getTime();
        const mins = Math.round(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return mins + 'm ago';
        const hours = Math.round(mins / 60);
        if (hours < 24) return hours + 'h ago';
        const days = Math.round(hours / 24);
        if (days < 7) return days + 'd ago';
        return date.toLocaleDateString();
    },

    async refreshNotifications() {
        const body = document.getElementById('notifyBody');
        const dot = document.getElementById('notifyDot');
        if (!body) return;
        try {
            const data = await RoamitraApi.get('/notifications');
            const unread = Number(data.unread) || 0;
            const messageUnread = (data.notifications || []).filter((item) =>
                item.type === 'message' && !(item.is_read == 1 || item.is_read === true)
            ).length;
            this.paintMessageBadge(messageUnread);
            if (this.previousMessageUnread !== null && messageUnread > this.previousMessageUnread) {
                const latest = (data.notifications || []).find((item) =>
                    item.type === 'message' && !(item.is_read == 1 || item.is_read === true)
                );
                this.showMessageToast(latest ? latest.body : 'You have a new message.');
            }
            this.previousMessageUnread = messageUnread;
            this.paintActivityBadge(unread);
            if (dot) {
                dot.hidden = unread === 0;
                dot.textContent = unread > 9 ? '9+' : String(unread);
            }
            const items = data.notifications || [];
            const upcoming = data.upcoming_trips || [];
            const saved = data.saved_trips || [];
            const recent = data.recent_itineraries || [];
            if (!items.length && !upcoming.length && !saved.length && !recent.length) {
                body.innerHTML = '<p class="notify-empty">No activity yet. Generate an itinerary, save a trip, or post in the community.</p>';
                return;
            }

            let html = '';
            if (recent.length) {
                html += '<p class="notify-section">Recently generated itineraries</p>';
                recent.forEach(t => {
                    html += `<a class="notify-item" href="${RoamitraApi.page('itinerary.html')}?trip=${t.id}">
                        <span class="notify-type">${this.escape(t.destination)}</span>
                        <span class="notify-meta">Version ${this.escape(t.version)} · ${this.relativeTime(t.created_at)}</span>
                    </a>`;
                });
            }
            if (saved.length) {
                html += '<p class="notify-section">Saved trips</p>';
                saved.forEach(t => {
                    html += `<a class="notify-item" href="${RoamitraApi.page('itinerary.html')}?trip=${t.id}">
                        <span class="notify-type">${this.escape(t.destination)}</span>
                        <span class="notify-meta">${this.escape(t.start_date)} → ${this.escape(t.end_date)}</span>
                    </a>`;
                });
            }
            if (upcoming.length) {
                html += '<p class="notify-section">Upcoming trips</p>';
                upcoming.forEach(t => {
                    html += `<a class="notify-item" href="${RoamitraApi.page('itinerary.html')}?trip=${t.id}">
                        <span class="notify-type">${this.escape(t.destination)}</span>
                        <span class="notify-meta">${this.escape(t.start_date)} → ${this.escape(t.end_date)}</span>
                    </a>`;
                });
            }
            if (items.length) {
                html += '<p class="notify-section">Community &amp; alerts</p>';
                items.forEach(n => {
                    const href = n.link ? RoamitraApi.page(n.link) : '#';
                    const unread = !(n.is_read == 1 || n.is_read === true);
                    html += `<a class="notify-item ${unread ? 'unread' : ''}" data-id="${n.id}" href="${href}">
                        <span class="notify-type">${this.escape(n.title)}</span>
                        <span class="notify-body">${this.escape(n.body || '')}</span>
                        <span class="notify-meta">${this.escape(this.typeLabel(n.type))} · ${this.relativeTime(n.created_at)}</span>
                    </a>`;
                });
            }
            body.innerHTML = html;
            body.querySelectorAll('.notify-item[data-id]').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.getAttribute('data-id');
                    if (id) RoamitraApi.post(`/notifications/${id}/read`, {}).catch(() => {});
                });
            });
        } catch (e) {
            body.innerHTML = '<p class="notify-empty">Could not load notifications.</p>';
        }
    },

    paintMessageBadge(unread) {
        const dot = document.getElementById('chatNavDot');
        if (!dot) return;
        dot.hidden = unread === 0;
        dot.textContent = unread > 99 ? '99+' : String(unread);
    },

    showMessageToast(message) {
        let toast = document.getElementById('messageToast');
        if (!toast) {
            toast = document.createElement('button');
            toast.type = 'button';
            toast.id = 'messageToast';
            toast.className = 'message-toast';
            document.body.appendChild(toast);
            toast.addEventListener('click', () => {
                document.getElementById('chatNavButton')?.click();
                toast.hidden = true;
            });
        }
        toast.innerHTML = `<i class="bi bi-chat-dots"></i><span>${this.escape(message)}</span>`;
        toast.hidden = false;
        clearTimeout(this.messageToastTimer);
        this.messageToastTimer = setTimeout(() => { toast.hidden = true; }, 6000);
    },

    escape(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof RoamitraApi !== 'undefined') {
        RoamitraNav.init();
    }
    const src = (typeof RoamitraApi !== 'undefined' ? RoamitraApi.basePath() : '') + 'assets/js/motion.js?v=m4';
    if (!document.querySelector('script[data-roamitra-motion]')) {
        const script = document.createElement('script');
        script.src = src;
        script.dataset.roamitraMotion = '1';
        document.body.appendChild(script);
    }
});
