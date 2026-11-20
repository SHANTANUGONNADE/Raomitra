document.addEventListener('DOMContentLoaded', async () => {
    const grids = document.querySelectorAll('#vehicleGrid, .vehicle-grid');
    if (!grids.length) return;

    try {
        const data = await RoamitraApi.get('/vehicles');
        const vehicles = data.vehicles || [];
        if (!vehicles.length) return;

        for (const grid of grids) {
            const fragment = document.createElement('div');
            fragment.className = 'row g-3';
            fragment.innerHTML = vehicles.map(vehicle => {
                const name = String(vehicle.name || 'Vehicle');
                const category = String(vehicle.category || 'vehicles');
                const price = Number(vehicle.price || 0);
                const location = String(vehicle.location || 'India');
                const label = { scooters: 'Scooter', bikes: 'Bike', cars: 'Car' }[category] || 'Vehicle';
                const image = {
                    scooters: 'assets/images/vehicles/activa6g.webp',
                    bikes: 'assets/images/vehicles/royal-enfield.jpg',
                    cars: 'assets/images/vehicles/marutiswift.webp'
                }[category] || 'assets/images/vehicles/activa6g.webp';
                return `<div class="col-lg-4 col-md-6">
                    <div class="vehicle-card" data-category="${category}">
                        <div class="vehicle-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(name)}"><span class="vehicle-category">${escapeHtml(label)}</span></div>
                        <div class="vehicle-body">
                            <h2 class="vehicle-title">${escapeHtml(name)}</h2>
                            <div class="vehicle-price">₹${price.toLocaleString('en-IN')} <span>/ day</span></div>
                            <div class="vehicle-location"><i class="bi bi-geo-alt"></i> ${escapeHtml(location)}</div>
                            <a class="btn-roamitra btn-roamitra-navy btn-roamitra-block"
                               href="booking.html?name=${encodeURIComponent(name)}&price=${encodeURIComponent(price)}&location=${encodeURIComponent(location)}&category=${encodeURIComponent(category)}&image=${encodeURIComponent(image)}">Book Now</a>
                        </div>
                    </div>
                </div>`;
            }).join('');
            grid.appendChild(fragment);
        }
    } catch (error) {
        // Static catalog remains usable if the API is unavailable.
    }

    function escapeHtml(text) {
        const element = document.createElement('div');
        element.textContent = text == null ? '' : String(text);
        return element.innerHTML;
    }
});
