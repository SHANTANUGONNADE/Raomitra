(function () {
    const KEY = 'roamitra.meetups.v2';
    const seeds = [
        {
            id: 'sunset-yoga',
            title: 'Sunset Beach Yoga & Bonfire',
            host: 'Emma Wilson',
            photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=60',
            place: 'Seminyak Beach, Bali',
            date: 'May 28, 2026',
            time: '5:30 PM',
            going: 12,
            capacity: 20,
            tags: ['Wellness', 'Social'],
            week: true,
            gradient: 'linear-gradient(100deg,#ff7a3c 0%,#e83e8c 48%,#7a3cff 100%)'
        },
        {
            id: 'ubud-walk',
            title: 'Ubud Morning Market Walk',
            host: 'Priya Sharma',
            photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&h=120&q=60',
            place: 'Ubud Art Market, Bali',
            date: 'May 30, 2026',
            time: '8:00 AM',
            going: 6,
            capacity: 16,
            tags: ['Food', 'Culture'],
            week: true,
            gradient: 'linear-gradient(100deg,#ffb703 0%,#fb5607 55%,#ff006e 100%)'
        },
        {
            id: 'goa-hangout',
            title: 'Goa Sunset Hangout',
            host: 'Raj Patel',
            photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=60',
            place: 'Anjuna Beach, Goa',
            date: 'Jun 6, 2026',
            time: '6:00 PM',
            going: 9,
            capacity: 18,
            tags: ['Beach', 'Social'],
            week: false,
            gradient: 'linear-gradient(100deg,#ff9f1c 0%,#ff6b00 100%)'
        }
    ];

    function load() {
        try {
            const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (Array.isArray(saved) && saved.length) return saved;
        } catch (err) { /* use seeds */ }
        return seeds.map((item) => Object.assign({ joined: false }, item));
    }

    function save(items) {
        localStorage.setItem(KEY, JSON.stringify(items));
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function card(item) {
        const going = Math.min(item.capacity, Number(item.going) || 0);
        return `
            <article class="lm-card">
                <div class="lm-banner" style="background:${item.gradient}">
                    <img src="${escapeHtml(item.photo)}" alt="" referrerpolicy="no-referrer">
                </div>
                <div class="lm-body">
                    <h3>${escapeHtml(item.title)}</h3>
                    <p class="lm-host">Hosted by ${escapeHtml(item.host)}</p>
                    <p><i class="bi bi-geo-alt"></i> ${escapeHtml(item.place)}</p>
                    <p><i class="bi bi-calendar3"></i> ${escapeHtml(item.date)}</p>
                    <p><i class="bi bi-clock"></i> ${escapeHtml(item.time)}</p>
                    <p><i class="bi bi-people"></i> ${going}/${item.capacity} going</p>
                    <div class="lm-tags">${(item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
                    <button type="button" class="lm-join" data-join="${escapeHtml(item.id)}" ${item.joined ? 'disabled' : ''}>${item.joined ? 'Joined' : 'Join Meetup'}</button>
                </div>
            </article>
        `;
    }

    function paint() {
        document.querySelectorAll('[data-meetup-root]').forEach((root) => {
            const filter = root.dataset.view || 'upcoming';
            const tag = root.dataset.activeTag || '';
            const items = load().filter((item) => {
                if (filter === 'week' && !item.week) return false;
                if (tag && !(item.tags || []).includes(tag)) return false;
                return true;
            });
            const list = root.querySelector('[data-meetup-list]');
            if (list) list.innerHTML = items.map(card).join('') || '<p class="lm-empty">No meetups in this view yet.</p>';
            root.querySelectorAll('[data-filter]').forEach((button) => {
                button.classList.toggle('on', button.dataset.filter === filter);
            });
            root.querySelectorAll('[data-tag]').forEach((button) => {
                button.classList.toggle('on', (button.dataset.tag || '') === tag);
            });
        });
    }

    function shell(page) {
        return `
            <div class="lm-head">
                ${page ? '<a class="lm-back" href="community.html" aria-label="Back to community"><i class="bi bi-chevron-left"></i></a>' : ''}
                <h2>Local Meetups</h2>
            </div>
            <div class="lm-tools">
                <div class="lm-pills">
                    <button type="button" data-filter="upcoming" class="on">Upcoming</button>
                    <button type="button" data-filter="week">This Week</button>
                </div>
                <button type="button" class="lm-filters" data-filters><i class="bi bi-sliders"></i> Filters</button>
            </div>
            <div class="lm-tagbar" data-tagbar hidden>
                <button type="button" data-tag="" class="on">All</button>
                <button type="button" data-tag="Wellness">Wellness</button>
                <button type="button" data-tag="Social">Social</button>
                <button type="button" data-tag="Food">Food</button>
                <button type="button" data-tag="Beach">Beach</button>
                <button type="button" data-tag="Culture">Culture</button>
            </div>
            <button type="button" class="lm-create" data-create>Create Meetup</button>
            <p class="lm-note" data-note hidden></p>
            <form class="lm-form" data-create-form hidden>
                <label>Title<input name="title" required maxlength="80" placeholder="Sunset beach yoga"></label>
                <label>Place<input name="place" required maxlength="80" placeholder="Seminyak Beach, Bali"></label>
                <label>Date<input name="date" required maxlength="40" placeholder="Jun 12, 2026"></label>
                <label>Time<input name="time" required maxlength="20" placeholder="5:30 PM"></label>
                <label>Spots<input name="capacity" type="number" min="2" max="200" value="20" required></label>
                <div class="lm-form-actions">
                    <button type="submit">Publish meetup</button>
                    <button type="button" data-cancel>Cancel</button>
                </div>
            </form>
            <div data-meetup-list></div>
        `;
    }

    document.querySelectorAll('[data-meetup-root]').forEach((root) => {
        root.dataset.view = 'upcoming';
        root.dataset.activeTag = '';
        root.innerHTML = shell(root.hasAttribute('data-meetup-page'));
        root.addEventListener('click', (event) => {
            const filter = event.target.closest('button[data-filter]');
            if (filter) {
                root.dataset.view = filter.dataset.filter;
                paint();
                return;
            }
            const tagBtn = event.target.closest('button[data-tag]');
            if (tagBtn) {
                root.dataset.activeTag = tagBtn.dataset.tag || '';
                paint();
                return;
            }
            if (event.target.closest('[data-filters]')) {
                const bar = root.querySelector('[data-tagbar]');
                if (bar) bar.hidden = !bar.hidden;
                return;
            }
            if (event.target.closest('[data-create]')) {
                const form = root.querySelector('[data-create-form]');
                form.hidden = false;
                const note = root.querySelector('[data-note]');
                if (note) note.hidden = true;
                form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                form.querySelector('input')?.focus();
                return;
            }
            if (event.target.closest('[data-cancel]')) {
                root.querySelector('[data-create-form]').hidden = true;
                return;
            }
            const join = event.target.closest('[data-join]');
            if (!join || join.disabled) return;
            const items = load();
            const item = items.find((row) => row.id === join.dataset.join);
            if (!item || item.joined || item.going >= item.capacity) return;
            item.joined = true;
            item.going += 1;
            save(items);
            paint();
        });
        root.addEventListener('submit', (event) => {
            const form = event.target.closest('[data-create-form]');
            if (!form) return;
            event.preventDefault();
            const data = new FormData(form);
            const items = load();
            items.unshift({
                id: 'm' + Date.now(),
                title: String(data.get('title') || '').trim(),
                host: 'You',
                photo: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=120&h=120&q=60',
                place: String(data.get('place') || '').trim(),
                date: String(data.get('date') || '').trim(),
                time: String(data.get('time') || '').trim(),
                going: 1,
                capacity: Math.max(2, parseInt(data.get('capacity'), 10) || 20),
                tags: ['Social'],
                week: true,
                joined: true,
                gradient: 'linear-gradient(100deg,#0b1f3a 0%,#12b36a 100%)'
            });
            save(items);
            form.reset();
            form.hidden = true;
            const note = root.querySelector('[data-note]');
            if (note) {
                note.hidden = false;
                note.textContent = 'Meetup published. You are marked as going.';
            }
            root.dataset.view = 'upcoming';
            paint();
        });
    });

    paint();
})();
