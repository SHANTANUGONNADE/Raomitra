(function () {
    if (window.RoamitraMeetupsInitialized) return;
    window.RoamitraMeetupsInitialized = true;

    let items = [];
    async function load() {
        const data = await RoamitraApi.get('/meetups');
        items = data.meetups || [];
        RoamitraNav.registerLocations(items.map((item) => item.place));
        return items;
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
                <div class="lm-banner" style="background:${escapeHtml(item.gradient || 'linear-gradient(100deg,#0b1f3a 0%,#12b36a 100%)')}">
                    ${item.photo ? `<img src="${escapeHtml(item.photo)}" alt="" referrerpolicy="no-referrer">` : '<i class="bi bi-people-fill" aria-hidden="true"></i>'}
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
            const location = RoamitraNav.currentLocation();
            const visible = items.filter((item) => {
                return !location || RoamitraNav.locationMatches(item.place);
            });
            const list = root.querySelector('[data-meetup-list]');
            if (list) list.innerHTML = visible.map(card).join('')
                || `<p class="lm-empty">${location ? `No meetups found in ${escapeHtml(location)} yet.` : 'No meetups available yet.'}</p>`;
        });
    }

    function shell(page) {
        return `
            <div class="lm-head">
                ${page ? '<a class="lm-back" href="community.html" aria-label="Back to community"><i class="bi bi-chevron-left"></i></a>' : ''}
                <h2>Local Meetups</h2>
            </div>
            <button type="button" class="lm-create" data-create>Create Meetup</button>
            <p class="lm-note" data-note hidden></p>
            <form class="lm-form" data-create-form hidden>
                <label>Title<input name="title" required maxlength="80" placeholder="Sunset beach yoga"></label>
                <label>Place<input name="place" required maxlength="80" placeholder="Seminyak Beach, Bali"></label>
                <label>Date<input name="date" type="date" required></label>
                <label>Time<input name="time" type="time" required></label>
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
        root.innerHTML = shell(root.hasAttribute('data-meetup-page'));
        root.addEventListener('click', (event) => {
            if (event.target.closest('[data-create]')) {
                const form = root.querySelector('[data-create-form]');
                if (!form.hidden) return;
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
            return;
        });
        root.addEventListener('submit', async (event) => {
            const form = event.target.closest('[data-create-form]');
            if (!form) return;
            event.preventDefault();
            const data = new FormData(form);
            const payload = {
                title: String(data.get('title') || '').trim(),
                place: String(data.get('place') || '').trim(),
                date: String(data.get('date') || '').trim(),
                time: String(data.get('time') || '').trim(),
                capacity: Math.max(2, parseInt(data.get('capacity'), 10) || 20)
            };
            const note = root.querySelector('[data-note]');
            const submit = form.querySelector('[type="submit"]');
            if (form.dataset.submitting === 'true') return;
            form.dataset.submitting = 'true';
            if (submit) submit.disabled = true;
            try {
                await RoamitraApi.post('/meetups', payload);
                form.reset();
                form.hidden = true;
                if (note) {
                    note.hidden = false;
                    note.textContent = 'Meetup published. You are marked as going.';
                }
                await refresh();
            } catch (error) {
                if (note) {
                    note.hidden = false;
                    note.textContent = error.message || 'Could not publish meetup.';
                }
            } finally {
                form.dataset.submitting = 'false';
                if (submit) submit.disabled = false;
            }
        });
    });

    async function refresh() {
        try { await load(); paint(); } catch (error) {
            document.querySelectorAll('[data-meetup-list]').forEach((list) => { list.innerHTML = `<p class="lm-empty">${escapeHtml(error.message || 'Could not load meetups.')}</p>`; });
        }
    }
    refresh();
    window.addEventListener('roamitra-location-updated', paint);
    setInterval(refresh, 30000);
})();
