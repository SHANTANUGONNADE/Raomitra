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
            const created = await RoamitraApi.post('/trips', data);
            btn.innerHTML = 'Generating itinerary…';
            const gen = await RoamitraApi.post(`/trips/${created.trip.id}/generate`, {});
            window.location.href = RoamitraApi.page('itinerary.html') + '?trip=' + gen.trip.id;
        } catch (err) {
            status.hidden = false;
            status.textContent = err.message || 'Could not generate itinerary.';
            status.className = 'form-alert error';
            btn.disabled = false;
            btn.innerHTML = 'Generate itinerary <i class="bi bi-arrow-right"></i>';
        }
    });
});
