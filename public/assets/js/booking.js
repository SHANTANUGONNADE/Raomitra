document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    const name = params.get('name') || 'Vehicle';
    const rate = Number(params.get('price') || 0);
    const locationText = params.get('location') || '';
    const category = params.get('category') || 'Vehicle';
    const image = params.get('image') || 'assets/images/vehicles/honda-activa.jpg';

    document.getElementById('bookName').textContent = name;
    document.getElementById('bookRate').textContent = String(rate);
    document.getElementById('bookLocation').innerHTML = locationText
        ? `<i class="bi bi-geo-alt"></i> ${escapeHtml(locationText)}`
        : '';
    document.getElementById('bookCategory').textContent = category;
    const img = document.getElementById('bookImage');
    img.src = image;
    img.alt = name;

    const start = document.getElementById('start_date');
    const end = document.getElementById('end_date');
    const today = new Date().toISOString().slice(0, 10);
    start.min = today;
    end.min = today;
    start.value = today;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    end.value = tomorrow;

    const summary = document.getElementById('bookSummary');
    const updateTotal = () => {
        const a = new Date(start.value);
        const b = new Date(end.value);
        if (!start.value || !end.value || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) {
            summary.textContent = 'Select a valid date range.';
            return;
        }
        const days = Math.round((b - a) / 86400000) + 1;
        const total = (rate * days).toFixed(2);
        summary.textContent = `${days} day(s) × $${rate} = $${total}`;
    };
    start.addEventListener('change', () => {
        end.min = start.value;
        if (end.value < start.value) end.value = start.value;
        updateTotal();
    });
    end.addEventListener('change', updateTotal);
    updateTotal();

    document.getElementById('bookingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertBox = document.getElementById('bookingAlert');
        const btn = document.getElementById('bookSubmit');
        alertBox.hidden = true;
        btn.disabled = true;
        try {
            const data = await RoamitraApi.post('/bookings', {
                vehicle_name: name,
                category,
                location: locationText,
                daily_rate: rate,
                start_date: start.value,
                end_date: end.value,
                notes: document.getElementById('notes').value.trim()
            });
            alertBox.className = 'form-alert';
            alertBox.style.background = 'var(--color-card-blue)';
            alertBox.textContent = data.message || 'Booking confirmed.';
            alertBox.hidden = false;
            btn.textContent = 'Booked';
            setTimeout(() => {
                window.location.href = RoamitraApi.page('profile.html');
            }, 1200);
        } catch (err) {
            if (err.status === 401) {
                const next = (location.pathname.split('/').pop() || 'booking.html') + location.search;
                window.location.href = RoamitraApi.page('login.html') + '?next=' + encodeURIComponent(next);
                return;
            }
            alertBox.className = 'form-alert error';
            alertBox.textContent = err.message || 'Could not complete booking.';
            alertBox.hidden = false;
            btn.disabled = false;
        }
    });

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }
});
