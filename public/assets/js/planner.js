document.addEventListener('DOMContentLoaded', () => {
    const groupWrap = document.getElementById('groupSizeWrap');
    const groupSize = document.getElementById('group_size');
    const form = document.getElementById('plannerForm');
    const status = document.getElementById('plannerStatus');
    const withInputs = document.querySelectorAll('input[name="traveling_with"]');

    function selectedWith() {
        const checked = document.querySelector('input[name="traveling_with"]:checked');
        return checked ? checked.value : 'solo';
    }

    function toggleGroup() {
        const isGroup = selectedWith() === 'group';
        groupWrap.hidden = !isGroup;
        groupSize.required = isGroup;
        if (!isGroup) {
            groupSize.value = '';
        }
    }

    withInputs.forEach(input => input.addEventListener('change', toggleGroup));
    toggleGroup();

    const editId = new URLSearchParams(window.location.search).get('edit');
    const submitBtn = form.querySelector('[type="submit"]');
    if (editId) {
        const title = document.querySelector('.planner-hero .section-title');
        if (title) title.textContent = 'Edit your trip';
        if (submitBtn) submitBtn.innerHTML = 'Update itinerary <i class="bi bi-arrow-right"></i>';
        RoamitraApi.get('/trips/' + editId).then((data) => {
            const trip = data.trip || {};
            const set = (id, value) => {
                const el = document.getElementById(id);
                if (el && value != null && value !== '') el.value = value;
            };
            set('destination', trip.destination);
            set('start_date', String(trip.start_date || '').slice(0, 10));
            set('end_date', String(trip.end_date || '').slice(0, 10));
            if (trip.budget != null) set('budget', trip.budget);
            const withRadio = form.querySelector(`input[name="traveling_with"][value="${trip.traveling_with}"]`);
            if (withRadio) withRadio.checked = true;
            toggleGroup();
            if (trip.traveling_with === 'group') {
                const size = Number(trip.group_size) >= 10 ? '10+' : String(trip.group_size || '');
                set('group_size', size);
            }
            const arrival = form.querySelector(`input[name="arrival_time"][value="${trip.arrival_time}"]`);
            const departure = form.querySelector(`input[name="departure_time"][value="${trip.departure_time}"]`);
            if (arrival) arrival.checked = true;
            if (departure) departure.checked = true;
            set('pace', trip.pace || 'moderate');
            let prefs = trip.preferences || [];
            if (typeof prefs === 'string') {
                try { prefs = JSON.parse(prefs); } catch (e) { prefs = []; }
            }
            form.querySelectorAll('input[name="preferences"]').forEach((input) => {
                input.checked = prefs.includes(input.value);
                input.closest('.pref-chip')?.classList.toggle('active', input.checked);
            });
        }).catch(() => {
            status.hidden = false;
            status.textContent = 'Could not load this trip to edit.';
            status.className = 'form-alert error';
        });
    }

    document.querySelectorAll('.pref-chip input').forEach(input => {
        input.addEventListener('change', () => {
            input.closest('.pref-chip').classList.toggle('active', input.checked);
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        status.hidden = true;
        const user = await RoamitraApi.me();
        if (!user) {
            window.location.href = RoamitraApi.page('login.html');
            return;
        }
        if (selectedWith() === 'group' && !groupSize.value) {
            status.hidden = false;
            status.textContent = 'Select how many people are traveling.';
            status.className = 'form-alert error';
            groupSize.focus();
            return;
        }
        const data = Object.fromEntries(new FormData(form).entries());
        data.preferences = [...form.querySelectorAll('input[name="preferences"]:checked')].map(i => i.value);
        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = 'Creating trip…';
        try {
            let tripId = editId;
            if (editId) {
                const updated = await RoamitraApi.post(`/trips/${editId}/update`, data);
                tripId = updated.trip.id;
                btn.innerHTML = 'Updating itinerary…';
            } else {
                const created = await RoamitraApi.post('/trips', data);
                tripId = created.trip.id;
                btn.innerHTML = 'Generating itinerary…';
            }
            const gen = await RoamitraApi.post(`/trips/${tripId}/generate`, {});
            window.location.href = RoamitraApi.page('itinerary.html') + '?trip=' + gen.trip.id;
        } catch (err) {
            status.hidden = false;
            status.textContent = err.message || 'Could not generate itinerary.';
            status.className = 'form-alert error';
            btn.disabled = false;
            btn.innerHTML = editId
                ? 'Update itinerary <i class="bi bi-arrow-right"></i>'
                : 'Generate itinerary <i class="bi bi-arrow-right"></i>';
        }
    });
});
