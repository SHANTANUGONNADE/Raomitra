document.addEventListener('DOMContentLoaded', async () => {
    const BOT_IMG = (typeof RoamitraApi !== 'undefined' ? RoamitraApi.basePath() : '') + 'assets/images/ai-bot.jpeg';

    function botAvatar() {
        return `<img src="${BOT_IMG}" alt="" class="ai-bot-photo">`;
    }
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get('trip');
    const requestedVersion = Number(params.get('version')) || null;
    const root = document.getElementById('itineraryRoot');
    const chatLog = document.getElementById('assistantLog');
    const chatForm = document.getElementById('assistantForm');
    const chatInput = document.getElementById('assistantInput');
    const saveBtn = document.getElementById('saveTripBtn');

    if (!tripId) {
        root.innerHTML = '<div class="form-alert error">No trip selected. <a href="roamini.html">Plan a trip</a>.</div>';
        return;
    }

    const user = await RoamitraApi.me();
    if (!user) {
        window.location.href = RoamitraApi.page('login.html');
        return;
    }

    async function load() {
        const versionQuery = requestedVersion ? `?version=${encodeURIComponent(requestedVersion)}` : '';
        const data = await RoamitraApi.get(`/trips/${tripId}${versionQuery}`);
        renderItinerary(data.trip, data.itinerary, data.versions || []);
        renderMessages(data.messages || []);
        return data;
    }

    async function renderHistory() {
        const history = document.getElementById('itineraryHistory');
        if (!history) return;
        try {
            const data = await RoamitraApi.get('/trips');
            const trips = (data.trips || []).filter((trip) =>
                trip.current_itinerary_id || ['generated', 'saved'].includes(String(trip.status || '').toLowerCase())
            );
            history.innerHTML = trips.length
                ? trips.map((trip) => `<a class="btn-roamitra btn-roamitra-outline btn-roamitra-sm" href="${RoamitraApi.page('itinerary.html')}?trip=${encodeURIComponent(trip.id)}">
                    ${escapeHtml(trip.destination || 'Trip')} · ${escapeHtml(trip.start_date || '')}
                </a>`).join('')
                : '<span class="text-muted">No generated itineraries yet.</span>';
        } catch (error) {
            history.innerHTML = '<span class="text-muted">Could not load itinerary history.</span>';
        }
    }

    function renderItinerary(trip, itinerary, versions) {
        if (!itinerary) {
            root.innerHTML = '<div class="form-alert error">This trip has no itinerary yet.</div>';
            return;
        }
        document.getElementById('tripTitle').textContent = trip.destination;
        document.getElementById('tripMeta').textContent =
            `${trip.start_date} → ${trip.end_date} · ${trip.traveling_with}${trip.traveling_with === 'group' ? ' · ' + trip.group_size + ' people' : ''} · Arrival ${label(trip.arrival_time)} · Depart ${label(trip.departure_time)}`;
        document.getElementById('versionLabel').textContent = `Version ${itinerary.version}`;
        const editBtn = document.getElementById('editTripBtn');
        if (editBtn) {
            editBtn.href = RoamitraApi.page('roamini.html') + '?plan=' + encodeURIComponent(trip.id);
        }

        const daysHtml = (itinerary.days || []).map(day => `
            <article class="itin-day">
                <header>
                    <h3>Day ${day.day} · ${day.date}</h3>
                    <p>${escapeHtml(day.theme || '')}</p>
                </header>
                <ul class="itin-acts">
                    ${(day.activities || []).map(a => `
                        <li>
                            <div class="itin-time">${escapeHtml(a.time)}–${escapeHtml(a.end_time)}</div>
                            <div>
                                <strong>${escapeHtml(a.title)}</strong>
                                <span class="itin-cat">${escapeHtml(a.category || '')}</span>
                                <p>${escapeHtml(a.notes || '')}</p>
                                ${a.map_url ? `<a href="${escapeHtml(a.map_url)}" target="_blank" rel="noopener noreferrer">Open place map</a>` : ''}
                            </div>
                            <div class="itin-cost">${a.cost_estimate ? '₹' + a.cost_estimate : ''}</div>
                        </li>
                    `).join('') || '<li class="itin-empty">No activities in this window.</li>'}
                </ul>
            </article>
        `).join('');

        const b = itinerary.budget || {};
        const acc = itinerary.accommodation || {};
        const tr = itinerary.transportation || {};

        root.innerHTML = `
            <p class="itin-summary">${escapeHtml(itinerary.summary || '')}</p>
            <div class="itin-grid">${daysHtml}</div>
            <div class="row g-3 mt-1">
                <div class="col-md-4">
                    <div class="itin-side-card">
                        <h4>${b.breakdown_type === 'budget_targets' ? 'Budget targets' : 'Budget estimate'}</h4>
                        <p class="itin-big">${b.estimated_total == null ? '—' : '₹' + b.estimated_total} <small>${escapeHtml(b.currency || 'INR')}</small></p>
                        ${b.estimated_total == null ? '<p>Live prices are not available; allocations below are spending targets, not quotes.</p>' : ''}
                        <p>Per person: ₹${b.per_person ?? '—'}</p>
                        ${b.user_budget != null ? `<p>Your budget: ₹${b.user_budget}${b.within_budget == null ? ' · spending target' : (b.within_budget ? ' · within budget' : ' · over budget')}</p>` : ''}
                        <ul class="itin-breakdown">
                            <li>${b.breakdown_type === 'budget_targets' ? 'Activities target' : 'Activities'}: ${b.breakdown?.activities == null ? '—' : '₹' + b.breakdown.activities}</li>
                            <li>${b.breakdown_type === 'budget_targets' ? 'Stay target' : 'Stay'}: ${b.breakdown?.accommodation == null ? '—' : '₹' + b.breakdown.accommodation}</li>
                            <li>${b.breakdown_type === 'budget_targets' ? 'Food target' : 'Food'}: ${b.breakdown?.food == null ? '—' : '₹' + b.breakdown.food}</li>
                            <li>${b.breakdown_type === 'budget_targets' ? 'Transport target' : 'Transport'}: ${b.breakdown?.local_transport == null ? '—' : '₹' + b.breakdown.local_transport}</li>
                        </ul>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="itin-side-card">
                        <h4>Accommodation</h4>
                        <p><strong>${escapeHtml(acc.type || '')}</strong></p>
                        <p>${escapeHtml(acc.recommendation || '')}</p>
                        ${acc.target_nightly_budget != null ? `<p>Target for all travelers: ₹${Number(acc.target_nightly_budget).toLocaleString()} per night</p>` : ''}
                        <p>${escapeHtml(acc.reason || '')}</p>
                        ${Array.isArray(acc.stays) && acc.stays.length ? `<ul>${acc.stays.map((stay) =>
                            `<li><a href="${escapeHtml(stay.map_url || stay.osm_url || acc.map_url || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(stay.name)}</a></li>`
                        ).join('')}</ul>` : ''}
                        ${acc.map_url ? `<a href="${escapeHtml(acc.map_url)}" target="_blank" rel="noopener noreferrer">Search current hotel listings</a>` : ''}
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="itin-side-card">
                        <h4>Transportation</h4>
                        <p>${escapeHtml(tr.local || '')}</p>
                        <p>${escapeHtml(tr.airport || '')}</p>
                        <p>${escapeHtml(tr.assistant_note || tr.note || '')}</p>
                    </div>
                </div>
            </div>
            ${itinerary.places_attribution_url ? `<p class="text-muted small mt-3">Place names and map locations from <a href="${escapeHtml(itinerary.places_attribution_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(itinerary.places_source || 'OpenStreetMap')}</a>. Confirm opening hours, prices, and availability with each venue.</p>` : ''}
            <div class="d-flex flex-wrap align-items-center gap-2 mt-3" aria-label="Itinerary versions">
                <span class="text-muted small">Versions:</span>
                ${versions.length ? versions.map((version) => {
                    const href = RoamitraApi.page('itinerary.html') + '?trip=' + encodeURIComponent(trip.id)
                        + '&version=' + encodeURIComponent(version.version);
                    const active = Number(version.version) === Number(itinerary.version);
                    return `<a class="btn-roamitra ${active ? 'btn-roamitra-navy' : 'btn-roamitra-outline'} btn-roamitra-sm" href="${href}">v${Number(version.version)}</a>`;
                }).join('') : `<span class="text-muted small">v${Number(itinerary.version)}</span>`}
            </div>
        `;
        saveBtn.hidden = trip.is_saved == 1;
    }

    function renderMessages(messages) {
        chatLog.innerHTML = '';
        if (!messages.length) {
            chatLog.innerHTML = `<div class="ai-message bot">
                <div class="ai-message-avatar">${botAvatar()}</div>
                <div class="ai-message-bubble">Your itinerary is ready. Ask me to add or remove places, change timings, find nearby restaurants or cafés, or adjust for weather, budget, or preferences. I will update the plan itself, not just chat.</div>
            </div>`;
            return;
        }
        messages.forEach(m => addChat(m.message, m.role === 'user' ? 'user' : 'bot'));
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    function addChat(text, type) {
        const msg = document.createElement('div');
        msg.className = `ai-message ${type}`;
        msg.innerHTML = `
            <div class="ai-message-avatar">${type === 'bot' ? botAvatar() : '<i class="bi bi-person-fill"></i>'}</div>
            <div class="ai-message-bubble">${escapeHtml(text)}</div>`;
        chatLog.appendChild(msg);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        addChat(text, 'user');
        const sendBtn = chatForm.querySelector('button');
        sendBtn.disabled = true;
        try {
            const data = await RoamitraApi.post(`/trips/${tripId}/assistant`, { message: text });
            addChat(data.reply, 'bot');
            const fresh = await RoamitraApi.get(`/trips/${tripId}`);
            renderItinerary(fresh.trip, data.itinerary || fresh.itinerary, fresh.versions || []);
        } catch (err) {
            addChat(err.message || 'Could not update the itinerary.', 'bot');
        } finally {
            sendBtn.disabled = false;
        }
    });

    document.querySelectorAll('.assistant-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.dataset.prompt;
            chatForm.requestSubmit();
        });
    });

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            try {
                await RoamitraApi.post(`/trips/${tripId}/save`, {});
                saveBtn.hidden = true;
                saveBtn.insertAdjacentHTML('afterend', '<span class="text-success small ms-2">Saved to your trips.</span>');
            } catch (err) {
                alert(err.message);
            }
        });
    }

    function label(v) {
        const legacyTimes = { morning: '09:00', afternoon: '14:00', evening: '18:00', late_night: '22:00' };
        const time = legacyTimes[v] || v;
        return /^\d{2}:\d{2}$/.test(time) ? `${time} IST` : 'Flexible';
    }
    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    try {
        renderHistory();
        await load();
    } catch (err) {
        root.innerHTML = `<div class="form-alert error">${escapeHtml(err.message)}</div>`;
    }
});
