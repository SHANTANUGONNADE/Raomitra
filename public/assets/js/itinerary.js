document.addEventListener('DOMContentLoaded', async () => {
    const BOT_IMG = (typeof RoamitraApi !== 'undefined' ? RoamitraApi.basePath() : '') + 'assets/images/ai-bot.jpeg';

    function botAvatar() {
        return `<img src="${BOT_IMG}" alt="" class="ai-bot-photo">`;
    }
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get('trip');
    const root = document.getElementById('itineraryRoot');
    const chatLog = document.getElementById('assistantLog');
    const chatForm = document.getElementById('assistantForm');
    const chatInput = document.getElementById('assistantInput');
    const saveBtn = document.getElementById('saveTripBtn');

    if (!tripId) {
        root.innerHTML = '<div class="form-alert error">No trip selected. <a href="planner.html">Plan a trip</a>.</div>';
        return;
    }

    const user = await RoamitraApi.me();
    if (!user) {
        window.location.href = RoamitraApi.page('login.html');
        return;
    }

    async function load() {
        const data = await RoamitraApi.get(`/trips/${tripId}`);
        renderItinerary(data.trip, data.itinerary, data.versions || []);
        renderMessages(data.messages || []);
        return data;
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
                            </div>
                            <div class="itin-cost">${a.cost_estimate ? '$' + a.cost_estimate : ''}</div>
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
                        <h4>Budget estimate</h4>
                        <p class="itin-big">$${b.estimated_total ?? '—'} <small>${b.currency || 'USD'}</small></p>
                        <p>Per person: $${b.per_person ?? '—'}</p>
                        ${b.user_budget != null ? `<p>Your budget: $${b.user_budget}${b.within_budget ? ' · within budget' : ' · over budget'}</p>` : ''}
                        <ul class="itin-breakdown">
                            <li>Activities: $${b.breakdown?.activities ?? 0}</li>
                            <li>Stay: $${b.breakdown?.accommodation ?? 0}</li>
                            <li>Food: $${b.breakdown?.food ?? 0}</li>
                            <li>Transport: $${b.breakdown?.local_transport ?? 0}</li>
                        </ul>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="itin-side-card">
                        <h4>Accommodation</h4>
                        <p><strong>${escapeHtml(acc.type || '')}</strong></p>
                        <p>${escapeHtml(acc.recommendation || '')}</p>
                        <p>${escapeHtml(acc.reason || '')}</p>
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
            <p class="text-muted small mt-3">History: ${versions.map(v => 'v' + v.version).join(' · ') || 'v' + itinerary.version}</p>
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
        return ({ morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', late_night: 'Late night' })[v] || 'Flexible';
    }
    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    try {
        await load();
    } catch (err) {
        root.innerHTML = `<div class="form-alert error">${escapeHtml(err.message)}</div>`;
    }
});
