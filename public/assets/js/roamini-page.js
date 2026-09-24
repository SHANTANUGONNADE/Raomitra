(function () {
    const GENERIC_PHOTO = '1488646953014';
    const PLACE_PHOTOS = {
        'uluwatu temple': 'photo-1537996194471-e657df975ab4',
        'tegallalang rice terraces': 'photo-1518548419970-58e3b4079ab2',
        'ubud sacred monkey forest': 'photo-1540573133985-87b6da6d54a9',
        'seminyak beach walk': 'photo-1539367628448-4bc5c82d8e8a',
        'ubud art market': 'photo-1555400038-63f5ba517a47',
        'tirta empul temple': 'photo-1559628233-100c798642d4',
        'nusa penida day trip': 'photo-1570789210967-2cac24afeb00',
        'canggu cafe hopping': 'photo-1495474472287-4d71bcdd2085',
        'jimbaran seafood dinner': 'photo-1559339352-11d035aa65de',
        'tanah lot sunset': 'photo-1573790387438-4da905039392',
        'warung babi guling ibu oka': 'photo-1569050467447-ce54b3bbc37d',
        'revolver espresso': 'photo-1501339847302-ac426a4a7cbb',
        'senso-ji temple': 'photo-1493976040374-85c8e12f0c0e',
        'shibuya crossing & hachiko': 'photo-1542051841857-5f90071e7989',
        'tsukiji outer market': 'photo-1579871494447-9811cf80d66c',
        'meiji jingu shrine': 'photo-1528164344705-47542687000d',
        'teamlab planets': 'photo-1561214115-f2f134cc4912',
        'akihabara electric town': 'photo-1554797589-7241bb691973',
        'shinjuku gyoen': 'photo-1490806843957-4378d406b619',
        'tokyo skytree': 'photo-1540959733332-eab4deabeeaf',
        'ichiran ramen shibuya': 'photo-1569718212165-3a8278d5f624',
        '% arabica omotesando': 'photo-1442512595331-e89e73853f31',
        'omoide yokocho': 'photo-1553621042-f6e147245754',
        'ghibli museum': 'photo-1579783902614-a3fb3927b6a5',
        'eiffel tower': 'photo-1502602898657-3e91760cbb34',
        'louvre museum': 'photo-1566127444979-b3d2b654e3d7',
        'montmartre & sacré-cœur': 'photo-1499856871958-5b9627545d1a',
        'amber fort': 'photo-1477587458883-47145ed94245',
        'hawa mahal': 'photo-1477587458883-47145ed94245',
        'city palace': 'photo-1599661046289-e31897846e41',
        'india gate & rajpath': 'photo-1587474260584-136574528ed5',
        'gateway of india': 'photo-1570168007204-dfb528c6958f',
        'burj khalifa at the top': 'photo-1512453979798-5ea266f8880c',
        'baga & calangute beach': 'photo-1512343879784-a960bf40e7f2',
        'palolem sunset': 'photo-1507525428034-b723cf961d3e'
    };
    const CATEGORY_PHOTOS = {
        food: ['photo-1414235077428-338989a2e8c0', 'photo-1504674900247-0877df9cc836', 'photo-1476224203421-9ac39bcb3327', 'photo-1565299624946-b28f40a0ae38'],
        restaurant: ['photo-1414235077428-338989a2e8c0', 'photo-1559339352-11d035aa65de', 'photo-1567620905732-2d1ec7ab7445', 'photo-1540189549336-e6e99c3679fe'],
        cafe: ['photo-1495474472287-4d71bcdd2085', 'photo-1501339847302-ac426a4a7cbb', 'photo-1442512595331-e89e73853f31', 'photo-1498804103079-a6351b050096'],
        nature: ['photo-1501785888041-af3ef285b470', 'photo-1432405972618-c60b0225b8f9', 'photo-1441974231531-c6227db76b6e', 'photo-1500530855697-b586d89ba3ee'],
        adventure: ['photo-1464822759023-fed622ff2c3b', 'photo-1551632811-561732d1e306', 'photo-1500534314209-a25ddb2bd429', 'photo-1469474968028-56623f02e42e'],
        culture: ['photo-1524492412937-b28074a5d7da', 'photo-1555881400-74d7acaacd8b', 'photo-1548013146-72479768bada', 'photo-1528164344705-47542687000d'],
        temple: ['photo-1537996194471-e657df975ab4', 'photo-1573790387438-4da905039392', 'photo-1493976040374-85c8e12f0c0e', 'photo-1548013146-72479768bada'],
        landmark: ['photo-1502602898657-3e91760cbb34', 'photo-1477587458883-47145ed94245', 'photo-1587474260584-136574528ed5', 'photo-1512453979798-5ea266f8880c'],
        city: ['photo-1540959733332-eab4deabeeaf', 'photo-1513635269975-59663e0ac1ad', 'photo-1480714378408-67cf0d13bc1b', 'photo-1449824913935-59a10b8d2000'],
        museum: ['photo-1577083552431-6e5fd01988ec', 'photo-1566127444979-b3d2b654e3d7', 'photo-1554907984-15263bfd63bd', 'photo-1572947650440-e8a97ef053b2'],
        market: ['photo-1555400038-63f5ba517a47', 'photo-1555529669-e69e7aa0ba9a', 'photo-1488459716781-31db52582fe9', 'photo-1578916171728-46686eac8d58'],
        shopping: ['photo-1555529669-e69e7aa0ba9a', 'photo-1441986300917-64674bd600d8', 'photo-1472851294608-062f824d29cc', 'photo-1483985988355-763728e1935b'],
        nightlife: ['photo-1470229722913-7c0e2dbbafd3', 'photo-1514525253161-7a46d19cd819', 'photo-1492684223066-81342ee5ff30', 'photo-1566737236500-c8ac43014a67'],
        beach: ['photo-1507525428034-b723cf961d3e', 'photo-1512343879784-a960bf40e7f2', 'photo-1500375592092-40eb2168fd21', 'photo-1473496169904-658ba7c44d8a'],
        accommodation: ['photo-1566073771259-6a8506099945', 'photo-1522708323590-d24dbb6b0267', 'photo-1551882547-ff40c63fe5fa', 'photo-1611892440504-42a792e24d32'],
        art: ['photo-1577083552431-6e5fd01988ec', 'photo-1579783902614-a3fb3927b6a5', 'photo-1460661419201-fd4cecdf8a8b', 'photo-1513364776144-60967b0f800f'],
        logistics: ['photo-1436491865332-7a61a109cc05', 'photo-1544620341-11cb2cd7c626', 'photo-1464037864426-26c8a1e2d1c1', 'photo-1474487548417-781cb71495f3'],
        default: ['photo-1467269204594-9661b134dd2b', 'photo-1476514525535-07fb3b4ae5f1', 'photo-1500530855697-b586d89ba3ee', 'photo-1488646953014-85cb44e25828']
    };

    function unsplash(photo) {
        return 'https://images.unsplash.com/' + photo + '?auto=format&fit=crop&w=480&q=60';
    }

    function hashText(text) {
        let hash = 0;
        const value = String(text || '');
        for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
        return hash;
    }

    const PHOTO_HINTS = [
        ['ubud art', 'photo-1555400038-63f5ba517a47'],
        ['art market', 'photo-1555400038-63f5ba517a47'],
        ['canggu', 'photo-1495474472287-4d71bcdd2085'],
        ['cafe hop', 'photo-1501339847302-ac426a4a7cbb'],
        ['babi guling', 'photo-1569050467447-ce54b3bbc37d'],
        ['revolver', 'photo-1442512595331-e89e73853f31'],
        ['espresso', 'photo-1495474472287-4d71bcdd2085'],
        ['tanah lot', 'photo-1573790387438-4da905039392'],
        ['uluwatu', 'photo-1537996194471-e657df975ab4'],
        ['rice terrace', 'photo-1518548419970-58e3b4079ab2'],
        ['monkey forest', 'photo-1540573133985-87b6da6d54a9'],
        ['seminyak', 'photo-1539367628448-4bc5c82d8e8a'],
        ['tirta empul', 'photo-1559628233-100c798642d4'],
        ['nusa penida', 'photo-1570789210967-2cac24afeb00'],
        ['jimbaran', 'photo-1559339352-11d035aa65de'],
        ['eiffel', 'photo-1502602898657-3e91760cbb34'],
        ['louvre', 'photo-1566127444979-b3d2b654e3d7'],
        ['senso-ji', 'photo-1493976040374-85c8e12f0c0e'],
        ['shibuya', 'photo-1542051841857-5f90071e7989'],
        ['amber fort', 'photo-1477587458883-47145ed94245'],
        ['hawa mahal', 'photo-1477587458883-47145ed94245'],
        ['gateway of india', 'photo-1570168007204-dfb528c6958f'],
        ['india gate', 'photo-1587474260584-136574528ed5'],
        ['burj', 'photo-1512453979798-5ea266f8880c']
    ];

    function photoFor(act) {
        const title = String(act.title || act.place || '').trim().toLowerCase();
        for (let i = 0; i < PHOTO_HINTS.length; i++) {
            if (title.indexOf(PHOTO_HINTS[i][0]) !== -1) return unsplash(PHOTO_HINTS[i][1]);
        }
        if (PLACE_PHOTOS[title]) return unsplash(PLACE_PHOTOS[title]);
        const names = Object.keys(PLACE_PHOTOS);
        for (let i = 0; i < names.length; i++) {
            if (names[i] && title.indexOf(names[i]) !== -1) return unsplash(PLACE_PHOTOS[names[i]]);
        }
        const stored = act.image || '';
        if (stored && stored.indexOf(GENERIC_PHOTO) === -1) return stored;
        const pool = CATEGORY_PHOTOS[act.category] || CATEGORY_PHOTOS.default;
        return unsplash(pool[hashText(title + '|' + (act.category || '')) % pool.length]);
    }

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
    let customStyles = [];
    let paceTouched = false;
    let syncing = false;

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

    function budgetChip(sourceTrip, sourceItinerary) {
        const budget = (sourceItinerary && sourceItinerary.budget) || {};
        const raw = sourceTrip && sourceTrip.budget != null && sourceTrip.budget !== ''
            ? sourceTrip.budget
            : budget.user_budget;
        let label = '';
        if (raw != null && raw !== '' && !Number.isNaN(Number(raw))) {
            label = '$' + Number(raw).toLocaleString() + ' budget';
        } else if (budget.estimated_total != null) {
            label = 'Est. $' + Number(budget.estimated_total).toLocaleString();
        }
        if (!label) return '';
        return `<span><i class="bi bi-wallet2"></i> ${escapeHtml(label)}</span>`;
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
        } catch (err) {
            trips = [];
        }
        paintTrips();
    }

    function paintTrips() {
        if (!tripList) return;
        tripList.innerHTML = '';
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
        if (source.start_date && source.end_date) setDaysFromDates();
        else setDatesFromDays();
        budgetInput.value = source.budget == null ? '' : source.budget;
        const withRadio = document.querySelector(`input[name="traveling_with"][value="${source.traveling_with || 'solo'}"]`);
        if (withRadio) withRadio.checked = true;
        toggleGroup();
        if (source.group_size) document.getElementById('raiGroup').value = String(source.group_size);
        const arrival = document.querySelector(`input[name="arrival_time"][value="${source.arrival_time || 'morning'}"]`);
        const departure = document.querySelector(`input[name="departure_time"][value="${source.departure_time || 'afternoon'}"]`);
        if (arrival) arrival.checked = true;
        if (departure) departure.checked = true;
        const pace = document.querySelector(`input[name="pace"][value="${source.pace || 'moderate'}"]`);
        if (pace) pace.checked = true;
        const prefs = prefsFromTrip(source.preferences);
        document.querySelectorAll('#raiStyles button').forEach((btn) => {
            const pref = btn.dataset.pref;
            const on = (pref && prefs.includes(pref)) || (btn.dataset.style === 'slow' && source.pace === 'relaxed');
            btn.classList.toggle('on', !!on);
        });
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
            arrival_time: document.querySelector('input[name="arrival_time"]:checked')?.value || 'morning',
            departure_time: document.querySelector('input[name="departure_time"]:checked')?.value || 'afternoon',
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
            await RoamitraApi.post('/trips/' + id + '/generate', {});
            tripId = String(id);
            editingId = id;
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
            ${budgetChip(trip, itinerary)}
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
        timeline.innerHTML = (day.activities || []).map((act) => {
            const start = act.time || act.start || '';
            const category = act.category || 'default';
            const photo = photoFor(act);
            const label = act.title || act.place || 'Stop';
            return `
                <article class="rai-stop">
                    <div class="rai-rail"><span></span></div>
                    <time>${escapeHtml(clock(start))}</time>
                    <div class="rai-ico"><i class="bi ${iconFor(category)}"></i></div>
                    <div>
                        <h3>${escapeHtml(label)}</h3>
                        <p>${escapeHtml(act.notes || '')}</p>
                    </div>
                    <img src="${photo}" alt="${escapeHtml(label)}" referrerpolicy="no-referrer">
                </article>
            `;
        }).join('') || '<p>No activities on this day.</p>';
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
        let chosen = id || tripId;
        if (!chosen) {
            try {
                const data = await RoamitraApi.get('/trips');
                const list = data.trips || [];
                const ready = list.find((item) => item.current_itinerary_id || item.status === 'generated' || item.status === 'saved');
                chosen = (ready || list[0] || {}).id;
            } catch (err) {
                chosen = '';
            }
        }
        if (!chosen) {
            setStatus('Generate an itinerary first, then choose Itineraries.', true);
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
    daysInput.oninput = setDatesFromDays;
    startInput.onchange = () => { setDatesFromDays(); };
    endInput.onchange = setDaysFromDates;
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
