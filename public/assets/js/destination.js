const DESTINATIONS = {
    bali: {
        title: 'Bali, Indonesia',
        meta: '4.8 rating · 16.7k travelers · from $1,200 / week',
        image: 'assets/images/destinations/bali.jpg',
        desc: 'Tropical paradise with stunning temples, rice terraces, and vibrant culture. Stay in Ubud for rice fields and yoga, or Canggu for surf and cafes.',
        facts: ['Beach', 'Culture', 'Adventure'],
        highlights: ['Visit Tanah Lot and Uluwatu at sunset', 'Try a cooking class in Ubud', 'Rent a scooter for day trips'],
        planner: 'Bali'
    },
    tokyo: {
        title: 'Tokyo, Japan',
        meta: '4.9 rating · 22.1k travelers · from $1,450 / week',
        image: 'assets/images/destinations/tokyo.jpg',
        desc: 'A dazzling blend of ultramodern and traditional, from neon-lit skyscrapers to historic temples. Use trains for most of the city, then rent a car for day trips.',
        facts: ['City', 'Food', 'Culture'],
        highlights: ['Shibuya crossing and teamLab Planets', 'Tsukiji outer market breakfast', 'Day trip to Kamakura or Hakone'],
        planner: 'Tokyo'
    },
    paris: {
        title: 'Paris, France',
        meta: '4.7 rating · 18.5k travelers · from $1,350 / week',
        image: 'assets/images/destinations/paris.jpg',
        desc: 'The City of Light enchants with its art, cuisine, and iconic landmarks. Walk the Seine, then hop a train to Versailles or the Loire.',
        facts: ['Romance', 'Art', 'Food'],
        highlights: ['Louvre or Musée d’Orsay', 'Sunset from Trocadéro', 'Neighborhood food crawl in Le Marais'],
        planner: 'Paris'
    },
    yosemite: {
        title: 'Yosemite National Park',
        meta: '4.9 rating · National Park · 180 miles away',
        image: 'assets/images/destinations/yosemite.jpg',
        desc: 'Granite cliffs, waterfalls, and valley views. Best with a rental car for trailheads and park loops.',
        facts: ['National Park', 'Hiking', 'Scenic'],
        highlights: ['Tunnel View at sunrise', 'Mist Trail to Vernal Fall', 'Glacier Point if roads are open'],
        planner: 'Yosemite'
    },
    tahoe: {
        title: 'Lake Tahoe',
        meta: '4.8 rating · Lake & Mountains · 95 miles away',
        image: 'assets/images/destinations/tahoe.jpg',
        desc: 'Alpine lake for swimming, hiking, and winter sports. A car or SUV makes it easy to hop between north and south shores.',
        facts: ['Lake', 'Mountains', 'Outdoors'],
        highlights: ['Emerald Bay overlook', 'East shore beaches', 'Tahoe Rim Trail day hike'],
        planner: 'Lake Tahoe'
    },
    bigsur: {
        title: 'Big Sur Coastline',
        meta: '4.7 rating · Scenic Drive · 120 miles away',
        image: 'assets/images/destinations/bigsur.jpg',
        desc: 'Pacific cliffs and Highway 1 pullouts. Rent a car and leave extra time for fog, traffic, and photo stops.',
        facts: ['Scenic Drive', 'Coast', 'Photography'],
        highlights: ['Bixby Creek Bridge', 'McWay Falls', 'Pfeiffer Beach if conditions allow'],
        planner: 'Big Sur'
    }
};

function renderDestination(place) {
    const dest = DESTINATIONS[place] || DESTINATIONS.bali;
    const title = document.getElementById('destTitle');
    const meta = document.getElementById('destMeta');
    const desc = document.getElementById('destDesc');
    const img = document.getElementById('destImage');
    const facts = document.getElementById('destFacts');
    const highlights = document.getElementById('destHighlights');
    const plan = document.getElementById('destPlan');
    if (!title || !img) return dest;

    document.title = dest.title + ' — Roamitra';
    title.textContent = dest.title;
    if (meta) meta.textContent = dest.meta;
    if (desc) desc.textContent = dest.desc;
    const base = typeof RoamitraApi !== 'undefined' ? RoamitraApi.basePath() : '';
    img.src = dest.image.indexOf('http') === 0 ? dest.image : base + dest.image;
    img.alt = dest.title;
    if (facts) {
        facts.innerHTML = dest.facts.map((f) => `<span class="destination-fact">${f}</span>`).join('');
    }
    if (highlights) {
        highlights.innerHTML = dest.highlights.map((h) => `<li>${h}</li>`).join('');
    }
    if (plan) {
        const plannerPage = typeof RoamitraApi !== 'undefined' ? RoamitraApi.page('planner.html') : 'planner.html';
        plan.href = plannerPage + '?destination=' + encodeURIComponent(dest.planner);
    }
    return dest;
}

window.RoamitraDestinations = { DESTINATIONS, renderDestination };

document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.dataset.destinationPage) return;
    const key = (new URLSearchParams(location.search).get('place') || 'bali').toLowerCase();
    renderDestination(key);
});
