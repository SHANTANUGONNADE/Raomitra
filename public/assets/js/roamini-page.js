(function () {
    const dest = document.getElementById('raiDest');
    const daysInput = document.getElementById('raiDays');
    const startInput = document.getElementById('raiStart');
    const endInput = document.getElementById('raiEnd');
    const budgetInput = document.getElementById('raiBudget');
    const styleText = document.getElementById('raiStyleText');
    const customBox = document.getElementById('raiCustomStyles');
    const statusEl = document.getElementById('raiStatus');
    const generateBtn = document.getElementById('raiGenerate');
    const planView = document.getElementById('raiPlan');
    const studio = document.getElementById('raiStudio');
    const side = document.getElementById('raiSide');
    const backdrop = document.getElementById('raiBackdrop');
    const menuBtn = document.getElementById('raiMenu');
    const tripList = document.getElementById('raiTripList');

    let editingId = '';
    let tripId = '';
    let trip = null;
    let itinerary = null;
    let dayIndex = 0;
    let fullOpen = false;
    let trips = [];
    let tripsError = '';
    let customStyles = [];
    let paceTouched = false;
    let syncing = false;
    let arrivalDateSelected = false;
    let departureDateSelected = false;

    function updateTravelTimeVisibility() {
        document.getElementById('raiArrivalTimeSection').hidden = !arrivalDateSelected || !startInput.value;
        document.getElementById('raiDepartureTimeSection').hidden = !departureDateSelected || !endInput.value;
    }

    function iso(date) {
        const z = (n) => String(n).padStart(2, '0');
        return date.getFullYear() + '-' + z(date.getMonth() + 1) + '-' + z(date.getDate());
    }

    function addDays(value, count) {
        const date = new Date(value + 'T00:00:00');
        date.setDate(date.getDate() + count);
        return iso(date);
    }

    function dayCount(start, end) {
        const a = new Date(start + 'T00:00:00');
        const b = new Date(end + 'T00:00:00');
        return Math.max(1, Math.round((b - a) / 86400000) + 1);
    }

    function setDatesFromDays() {
        if (syncing) return;
        syncing = true;
        const start = startInput.value || iso(new Date());
        startInput.value = start;
        const count = Math.max(1, Math.min(14, parseInt(daysInput.value, 10) || 1));
        daysInput.value = String(count);
        endInput.value = addDays(start, count - 1);
        syncing = false;
    }

    function setDaysFromDates() {
        if (syncing || !startInput.value || !endInput.value) return;
        if (endInput.value < startInput.value) endInput.value = startInput.value;
        syncing = true;
        daysInput.value = String(Math.min(14, dayCount(startInput.value, endInput.value)));
        syncing = false;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function escapeAttribute(text) {
        return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function setStatus(text, error) {
        statusEl.textContent = text || '';
        statusEl.classList.toggle('error', !!error);
    }

    function refreshGenerate() {
        generateBtn.classList.toggle('ready', dest.value.trim().length > 1);
    }

    function paintCustom() {
        customBox.innerHTML = customStyles.map((style, i) =>
            `<button type="button" data-remove="${i}">${escapeHtml(style)} ×</button>`
        ).join('');
    }

    function selectedStyles() {
        return [...document.querySelectorAll('#raiStyles button.on')];
    }

    function peopleLabel(withWhom, size) {
        if (withWhom === 'couple') return '2 People';
        if (withWhom === 'group') return (size || 4) + ' People';
        if (withWhom === 'family') return 'Family';
        if (withWhom === 'friends') return 'Friends';
        return '1 Person';
    }

    function clock(value) {
        const raw = String(value || '').slice(0, 5);
        const parts = raw.split(':');
        if (parts.length < 2) return raw;
        let hour = parseInt(parts[0], 10);
        if (Number.isNaN(hour)) return raw;
        const suffix = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return String(hour).padStart(2, '0') + ':' + parts[1] + ' ' + suffix;
    }

    function formatDayDate(value) {
        const date = new Date(String(value || '') + 'T00:00:00');
        return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
        });
    }

    function iconFor(category) {
        const icons = {
            food: 'bi-cup-hot',
            nature: 'bi-tree',
            adventure: 'bi-compass',
            shopping: 'bi-bag',
            nightlife: 'bi-fire',
            beach: 'bi-water',
            accommodation: 'bi-house',
            culture: 'bi-bank',
            art: 'bi-palette',
            logistics: 'bi-airplane'
        };
        return icons[category] || 'bi-geo-alt';
    }

    function markNav() {
        document.getElementById('raiMenuItin').classList.toggle('on', !studio.hidden);
    }

    function openMenu(open) {
        side.classList.toggle('open', open);
        backdrop.hidden = !open;
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        markNav();
    }

    function showPlan() {
        planView.hidden = false;
        studio.hidden = true;
        document.getElementById('raiApp').classList.remove('is-studio');
        openMenu(false);
        markNav();
    }

    function showStudio() {
        planView.hidden = true;
        studio.hidden = false;
        document.getElementById('raiApp').classList.add('is-studio');
        openMenu(false);
        markNav();
    }

    async function loadTrips() {
        try {
            const data = await RoamitraApi.get('/trips');
            trips = data.trips || [];
            tripsError = '';
        } catch (err) {
            trips = [];
            tripsError = err.message || 'Could not load trip history.';
        }
        paintTrips();
    }

    function paintTrips() {
        if (!tripList) return;
        if (tripsError) {
            tripList.innerHTML = `<p class="rai-trips-message">${escapeHtml(tripsError)}</p>`;
            return;
        }
        if (!trips.length) {
            tripList.innerHTML = '<p class="rai-trips-message">Your trips will appear here.</p>';
            return;
        }
        tripList.innerHTML = trips.map((item) => {
            const ready = item.current_itinerary_id || item.status === 'generated' || item.status === 'saved';
            const dates = item.start_date && item.end_date
                ? `${escapeHtml(item.start_date)} – ${escapeHtml(item.end_date)}`
                : 'Dates not set';
            return `
                <button type="button" class="rai-trip" data-trip-id="${escapeHtml(item.id)}">
                    <strong>${escapeHtml(item.destination || 'Trip')}</strong>
                    <small>${dates}</small>
                    <small>${ready ? 'Itinerary ready' : 'Continue planning'}</small>
                </button>
            `;
        }).join('');
    }

    function prefsFromTrip(value) {
        if (Array.isArray(value)) return value.map(String);
        if (typeof value === 'string' && value) {
            try { return JSON.parse(value); } catch (err) { return value.split(','); }
        }
        return [];
    }

    function fillForm(source) {
        dest.value = source.destination || '';
        if (source.start_date) startInput.value = source.start_date;
        if (source.end_date) endInput.value = source.end_date;
        arrivalDateSelected = Boolean(source.start_date);
        departureDateSelected = Boolean(source.end_date);
        updateTravelTimeVisibility();
        if (source.start_date && source.end_date) setDaysFromDates();
        else setDatesFromDays();
        budgetInput.value = source.budget == null ? '' : source.budget;
        const withRadio = document.querySelector(`input[name="traveling_with"][value="${source.traveling_with || 'solo'}"]`);
        if (withRadio) withRadio.checked = true;
        toggleGroup();
        if (source.group_size) document.getElementById('raiGroup').value = String(source.group_size);
        const legacyTimes = { morning: '09:00', afternoon: '14:00', evening: '18:00', late_night: '22:00' };
        const arrival = document.querySelector('input[name="arrival_time"]');
        const departure = document.querySelector('input[name="departure_time"]');
        if (arrival) arrival.value = legacyTimes[source.arrival_time] || source.arrival_time || '10:00';
        if (departure) departure.value = legacyTimes[source.departure_time] || source.departure_time || '14:00';
        const pace = document.querySelector(`input[name="pace"][value="${source.pace || 'moderate'}"]`);
        if (pace) pace.checked = true;
        const prefs = prefsFromTrip(source.preferences);
        const standardPrefs = new Set([
            ...Array.from(document.querySelectorAll('#raiStyles button[data-pref], #raiInterests input'))
                .map((input) => input.dataset.pref || input.value)
                .filter(Boolean)
        ]);
        customStyles = prefs.filter((preference) => !standardPrefs.has(preference));
        paintCustom();
        document.querySelectorAll('#raiStyles button').forEach((btn) => {
            const pref = btn.dataset.pref;
            const on = (pref && prefs.includes(pref)) || (btn.dataset.style === 'slow' && source.pace === 'relaxed');
            btn.classList.toggle('on', !!on);
        });
        if (customStyles.length) {
            document.querySelector('#raiStyles button[data-style="custom"]').classList.add('on');
        }
        document.querySelectorAll('#raiInterests input').forEach((input) => {
            input.checked = prefs.includes(input.value);
        });
        refreshGenerate();
    }

    function toggleGroup() {
        const group = document.querySelector('input[name="traveling_with"]:checked')?.value === 'group';
        document.getElementById('raiGroup').hidden = !group;
        document.getElementById('raiGroupLabel').hidden = !group;
    }

    function collectPrefs() {
        const prefs = new Set();
        selectedStyles().forEach((btn) => { if (btn.dataset.pref) prefs.add(btn.dataset.pref); });
        document.querySelectorAll('#raiInterests input:checked').forEach((input) => prefs.add(input.value));
        customStyles.forEach((style) => prefs.add(style));
        return [...prefs];
    }

    async function submitPlan(event) {
        event.preventDefault();
        setDatesFromDays();
        const destination = dest.value.trim();
        if (destination.length < 2) {
            setStatus('Enter where you are going.', true);
            return;
        }
        const withWhom = document.querySelector('input[name="traveling_with"]:checked')?.value || 'solo';
        let pace = document.querySelector('input[name="pace"]:checked')?.value || 'moderate';
        if (!paceTouched && selectedStyles().some((btn) => btn.dataset.style === 'slow')) pace = 'relaxed';
        const body = {
            destination,
            start_date: startInput.value,
            end_date: endInput.value,
            budget: budgetInput.value === '' ? null : Number(budgetInput.value),
            traveling_with: withWhom,
            group_size: withWhom === 'group' ? document.getElementById('raiGroup').value : null,
            arrival_time: document.querySelector('input[name="arrival_time"]')?.value || '10:00',
            departure_time: document.querySelector('input[name="departure_time"]')?.value || '14:00',
            preferences: collectPrefs(),
            pace
        };
        generateBtn.disabled = true;
        setStatus('Creating your itinerary…');
        try {
            const saved = editingId
                ? await RoamitraApi.post('/trips/' + editingId + '/update', body)
                : await RoamitraApi.post('/trips', body);
            const id = saved.trip?.id || saved.id || editingId;
            tripId = String(id);
            editingId = id;
            await RoamitraApi.post('/trips/' + id + '/generate', {});
            await loadTrips();
            setStatus('');
            const next = new URL(window.location.href);
            next.searchParams.set('view', 'itinerary');
            next.searchParams.set('trip', String(id));
            next.searchParams.delete('plan');
            next.searchParams.delete('edit');
            history.replaceState({}, '', next.pathname + next.search);
            await openItinerary(id);
        } catch (err) {
            setStatus(err.message || 'Could not create the itinerary.', true);
        } finally {
            generateBtn.disabled = false;
        }
    }

    function renderStudio() {
        if (!trip || !itinerary) {
            document.getElementById('raiTimeline').innerHTML = '<p>This trip has no itinerary yet. Go back to New Plan and generate one.</p>';
            return;
        }
        const count = dayCount(trip.start_date, trip.end_date);
        const nights = Math.max(0, count - 1);
        document.getElementById('raiMeta').innerHTML = `
            <span><i class="bi bi-geo-alt"></i> ${escapeHtml(trip.destination)}</span>
            <span><i class="bi bi-calendar3"></i> ${count} Days · ${nights} Nights</span>
            <span><i class="bi bi-people"></i> ${escapeHtml(peopleLabel(trip.traveling_with, trip.group_size))}</span>
            <button type="button" class="rai-edit" id="raiEdit"><i class="bi bi-pencil"></i> Edit</button>
        `;
        document.getElementById('raiEdit').onclick = () => {
            fillForm(trip);
            editingId = trip.id;
            showPlan();
        };
        const days = itinerary.days || [];
        document.getElementById('raiDaysTabs').innerHTML = days.map((day, index) =>
            `<button type="button" class="${index === dayIndex ? 'on' : ''}" data-day="${index}">Day ${day.day || index + 1}</button>`
        ).join('');
        const day = days[dayIndex] || days[0];
        if (!day) return;
        const timeline = document.getElementById('raiTimeline');
        const dayHeading = `
            <header class="rai-day-heading">
                <span>Day ${Number(day.day) || dayIndex + 1}</span>
                <h2>${escapeHtml(day.theme || trip.destination)}</h2>
                <p>${escapeHtml(formatDayDate(day.date))}</p>
            </header>
        `;
        const activityHtml = (day.activities || []).map((act, index) => {
            const start = act.time || act.start || '';
            const category = act.category || 'default';
            const photo = window.RoamitraPlaceImages.forActivity(act, trip.destination);
            const label = act.title || act.place || 'Stop';
            return `
                <article class="rai-stop">
                    <div class="rai-rail"><span></span></div>
                    <time>${escapeHtml(clock(start))}</time>
                    <div class="rai-ico"><i class="bi ${iconFor(category)}"></i></div>
                    <div>
                        <h3>${escapeHtml(label)}</h3>
                        <p>${escapeHtml(act.notes || '')}</p>
                        ${act.map_url ? `<a href="${escapeHtml(act.map_url)}" target="_blank" rel="noopener noreferrer">Open place map</a>` : ''}
                    </div>
                    <img class="rai-stop-photo" ${photo
                        ? `src="${escapeAttribute(photo)}"`
                        : `data-photo-index="${index}" style="display:none"`
                    } alt="${escapeAttribute(label)}" loading="lazy" referrerpolicy="no-referrer">
                </article>
            `;
        }).join('') || '<p>No mapped places were found for this day.</p>';
        const accommodation = itinerary.accommodation || {};
        const liveDetails = dayIndex === 0 && itinerary.places_source ? `
            <section class="rai-live-data">
                <h3>Stay suggestions</h3>
                <p>Hotel rates and availability are not displayed here.</p>
                ${Array.isArray(accommodation.stays) && accommodation.stays.length
                    ? `<h4>Nearby stay listings</h4><ul>${accommodation.stays.map((stay) => `<li><a href="${escapeHtml(stay.map_url || stay.osm_url || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(stay.name)}</a></li>`).join('')}</ul>`
                    : `<a href="${escapeHtml(accommodation.map_url || '#')}" target="_blank" rel="noopener noreferrer">Search hotels in ${escapeHtml(trip.destination)}</a>`}
                <p class="rai-data-source">Place suggestions: ${itinerary.places_attribution_url
                    ? `<a href="${escapeHtml(itinerary.places_attribution_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(itinerary.places_source)}</a>`
                    : `<strong>${escapeHtml(itinerary.places_source)}</strong>`}. Check opening hours and availability before visiting or booking.</p>
            </section>
        ` : '';
        timeline.innerHTML = dayHeading + activityHtml + liveDetails;
        timeline.querySelectorAll('.rai-stop-photo').forEach((image) => {
            image.addEventListener('error', () => {
                image.style.display = 'none';
            }, { once: true });
        });
        hydrateStopPhotos(day.activities || [], trip.destination, timeline);
        if (dayIndex === 0) {
            timeline.style.minHeight = '0px';
            const dayOneHeight = timeline.offsetHeight;
            if (dayOneHeight > 80) timeline.dataset.day1Height = String(dayOneHeight);
        }
        if (timeline.dataset.day1Height) {
            timeline.style.minHeight = timeline.dataset.day1Height + 'px';
        }
        const full = document.getElementById('raiFullBody');
        full.hidden = !fullOpen;
        full.innerHTML = fullOpen ? (day.activities || []).map((act) =>
            `<p><strong>${escapeHtml(clock(act.time || act.start))} ${escapeHtml(act.title || '')}</strong><br>${escapeHtml(act.notes || '')}</p>`
        ).join('') : '';
        document.getElementById('raiFullBtn').textContent = fullOpen ? 'Hide full day plan' : 'View full day plan →';
    }

    function hydrateStopPhotos(activities, destination, timeline) {
        activities.forEach((activity, index) => {
            const image = timeline.querySelector(`.rai-stop-photo[data-photo-index="${index}"]`);
            if (!image) return;
            window.RoamitraPlaceImages.resolve(activity, destination).then((photo) => {
                if (!photo || !timeline.contains(image)) return;
                image.src = photo;
                image.style.display = '';
            });
        });
    }

    function renderChat(messages) {
        const log = document.getElementById('raiChatLog');
        const rows = messages && messages.length ? messages : [{
            role: 'assistant',
            message: "Hi there! I'm Roamini. I've created this itinerary just for you. How does it look?"
        }];
        log.innerHTML = rows.map((row) => {
            const mine = row.role === 'user';
            return `<div class="rai-bubble ${mine ? 'user' : 'bot'}">${escapeHtml(row.message || row.text || '')}</div>`;
        }).join('');
        log.scrollTop = log.scrollHeight;
    }

    async function openItinerary(id) {
        let chosen = id || '';
        if (!chosen) {
            if (!trips.length && !tripsError) await loadTrips();
            const active = trips.find((item) => String(item.id) === String(tripId)
                && (item.current_itinerary_id || item.status === 'generated' || item.status === 'saved'));
            const ready = trips.find((item) => item.current_itinerary_id || item.status === 'generated' || item.status === 'saved');
            chosen = (active || ready || {}).id;
        }
        if (!chosen) {
            setStatus(tripsError || 'Generate an itinerary first, then choose Itinerary.', true);
            showPlan();
            return;
        }
        tripId = String(chosen);
        showStudio();
        document.getElementById('raiTimeline').innerHTML = '<p>Loading itinerary…</p>';
        try {
            const data = await RoamitraApi.get('/trips/' + tripId);
            trip = data.trip;
            itinerary = data.itinerary;
            dayIndex = 0;
            fullOpen = false;
            renderStudio();
            renderChat(data.messages || []);
        } catch (err) {
            document.getElementById('raiTimeline').innerHTML = '<p>' + escapeHtml(err.message || 'Could not load this itinerary.') + '</p>';
        }
    }

    async function ask(text) {
        const message = String(text || '').trim();
        if (!message || !tripId) return;
        const log = document.getElementById('raiChatLog');
        log.insertAdjacentHTML('beforeend', `<div class="rai-bubble user">${escapeHtml(message)}</div>`);
        log.scrollTop = log.scrollHeight;
        try {
            const data = await RoamitraApi.post('/trips/' + tripId + '/assistant', { message });
            if (data.itinerary) itinerary = data.itinerary;
            const fresh = await RoamitraApi.get('/trips/' + tripId);
            trip = fresh.trip;
            itinerary = data.itinerary || fresh.itinerary;
            renderStudio();
            renderChat(fresh.messages || []);
        } catch (err) {
            log.insertAdjacentHTML('beforeend', `<div class="rai-bubble bot">${escapeHtml(err.message || 'Could not update the itinerary.')}</div>`);
        }
    }

    document.getElementById('raiForm').onsubmit = submitPlan;
    dest.oninput = refreshGenerate;
    daysInput.oninput = () => {
        setDatesFromDays();
        arrivalDateSelected = Boolean(startInput.value);
        departureDateSelected = Boolean(endInput.value);
        updateTravelTimeVisibility();
    };
    startInput.onchange = () => {
        arrivalDateSelected = true;
        setDatesFromDays();
        departureDateSelected = Boolean(endInput.value);
        updateTravelTimeVisibility();
    };
    endInput.onchange = () => {
        departureDateSelected = true;
        setDaysFromDates();
        updateTravelTimeVisibility();
    };
    styleText.onkeydown = (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const value = styleText.value.trim();
        if (!value) return;
        customStyles.push(value);
        styleText.value = '';
        paintCustom();
        document.querySelector('#raiStyles button[data-style="custom"]').classList.add('on');
    };
    customBox.onclick = (event) => {
        const button = event.target.closest('[data-remove]');
        if (!button) return;
        customStyles.splice(Number(button.dataset.remove), 1);
        paintCustom();
    };
    document.getElementById('raiStyles').onclick = (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        button.classList.toggle('on');
        if (button.dataset.style === 'solo' && button.classList.contains('on')) {
            document.querySelector('input[name="traveling_with"][value="solo"]').checked = true;
            toggleGroup();
        }
        if (button.dataset.style === 'slow' && button.classList.contains('on') && !paceTouched) {
            document.querySelector('input[name="pace"][value="relaxed"]').checked = true;
        }
    };
    document.querySelectorAll('input[name="traveling_with"]').forEach((input) => {
        input.onchange = toggleGroup;
    });
    document.querySelectorAll('input[name="pace"]').forEach((input) => {
        input.onchange = () => { paceTouched = true; };
    });
    let menuOpenedAt = 0;
    function setMenu(open) {
        if (open) menuOpenedAt = Date.now();
        openMenu(open);
    }
    menuBtn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenu(!side.classList.contains('open'));
    };
    document.getElementById('raiSideClose').onclick = () => setMenu(false);
    backdrop.onclick = () => {
        if (Date.now() - menuOpenedAt < 400) return;
        setMenu(false);
    };
    document.getElementById('raiMenuItin').onclick = () => {
        openMenu(false);
        openItinerary('');
    };
    tripList.onclick = async (event) => {
        const button = event.target.closest('[data-trip-id]');
        if (!button) return;
        const selected = trips.find((item) => String(item.id) === button.dataset.tripId);
        if (!selected) return;
        setMenu(false);
        const ready = selected.current_itinerary_id || selected.status === 'generated' || selected.status === 'saved';
        if (ready) {
            await openItinerary(selected.id);
            return;
        }
        try {
            const data = await RoamitraApi.get('/trips/' + selected.id);
            tripId = String(selected.id);
            editingId = String(selected.id);
            fillForm(data.trip);
            setStatus('This trip has no itinerary yet. Finish planning below.');
            showPlan();
        } catch (err) {
            setStatus(err.message || 'Could not open this trip.', true);
            showPlan();
        }
    };
    document.getElementById('raiStudioNew').onclick = () => {
        editingId = '';
        showPlan();
    };
    document.getElementById('raiDaysTabs').onclick = (event) => {
        const button = event.target.closest('[data-day]');
        if (!button) return;
        dayIndex = Number(button.dataset.day);
        fullOpen = false;
        renderStudio();
    };
    document.getElementById('raiFullBtn').onclick = () => {
        fullOpen = !fullOpen;
        renderStudio();
    };
    document.getElementById('raiChatForm').onsubmit = (event) => {
        event.preventDefault();
        const input = document.getElementById('raiChatInput');
        const text = input.value;
        input.value = '';
        ask(text);
    };
    document.getElementById('raiSuggest').onclick = (event) => {
        const button = event.target.closest('[data-ask]');
        if (button) ask(button.dataset.ask);
    };

    setDatesFromDays();
    refreshGenerate();
    const params = new URLSearchParams(location.search);
    const incoming = params.get('plan') || params.get('edit') || '';
    const named = params.get('destination') || '';
    if (named) dest.value = named;
    if (incoming && incoming !== 'new') {
        editingId = incoming;
        RoamitraApi.get('/trips/' + incoming).then((data) => {
            if (data.trip) fillForm(data.trip);
        }).catch(() => {});
    }
    if (params.get('view') === 'itinerary') {
        openItinerary(params.get('trip') || '');
    }
    loadTrips();
    refreshGenerate();
})();
