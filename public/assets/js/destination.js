const DESTINATIONS = {
    bali: {
        title: 'Bali, Indonesia',
        meta: '4.8 rating · 16.7k travelers · from $1,200 / week',
        image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&h=520&fit=crop',
        desc: 'Tropical paradise with stunning temples, rice terraces, and vibrant culture. Stay in Ubud for rice fields and yoga, or Canggu for surf and cafes.',
        facts: ['Beach', 'Culture', 'Adventure'],
        highlights: ['Visit Tanah Lot and Uluwatu at sunset', 'Try a cooking class in Ubud', 'Rent a scooter for day trips'],
        planner: 'Bali',
        rating: '4.8',
        travelers: '16.7k travelers',
        price: '$1,200',
        keywords: 'bali indonesia ubud canggu temple beach tropical'
    },
    tokyo: {
        title: 'Tokyo, Japan',
        meta: '4.9 rating · 22.1k travelers · from $1,450 / week',
        image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&h=520&fit=crop',
        desc: 'A dazzling blend of ultramodern and traditional, from neon-lit skyscrapers to historic temples. Use trains for most of the city, then rent a car for day trips.',
        facts: ['City', 'Food', 'Culture'],
        highlights: ['Shibuya crossing and teamLab Planets', 'Tsukiji outer market breakfast', 'Day trip to Kamakura or Hakone'],
        planner: 'Tokyo',
        rating: '4.9',
        travelers: '22.1k travelers',
        price: '$1,450',
        keywords: 'tokyo japan shibuya sushi city'
    },
    paris: {
        title: 'Paris, France',
        meta: '4.7 rating · 18.5k travelers · from $1,350 / week',
        image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=520&fit=crop',
        desc: 'The City of Light enchants with its art, cuisine, and iconic landmarks. Walk the Seine, then hop a train to Versailles or the Loire.',
        facts: ['Romance', 'Art', 'Food'],
        highlights: ['Louvre or Musée d’Orsay', 'Sunset from Trocadéro', 'Neighborhood food crawl in Le Marais'],
        planner: 'Paris',
        rating: '4.7',
        travelers: '18.5k travelers',
        price: '$1,350',
        keywords: 'paris france eiffel seine romance'
    },
    rome: {
        title: 'Rome, Italy',
        meta: '4.8 rating · 19.2k travelers · from $1,280 / week',
        image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&h=520&fit=crop',
        desc: 'Ancient ruins, espresso bars, and evening passeggiata. Walk the centro, then train out to Tivoli or the coast.',
        facts: ['History', 'Food', 'City'],
        highlights: ['Colosseum and Forum at opening hour', 'Trastevere dinner walk', 'Gelato near Piazza Navona'],
        planner: 'Rome',
        rating: '4.8',
        travelers: '19.2k travelers',
        price: '$1,280',
        keywords: 'rome italy colosseum vatican pasta'
    },
    barcelona: {
        title: 'Barcelona, Spain',
        meta: '4.7 rating · 17.4k travelers · from $1,180 / week',
        image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&h=520&fit=crop',
        desc: 'Gaudí skyline, tapas streets, and Mediterranean beaches a metro ride apart.',
        facts: ['Beach', 'Architecture', 'Food'],
        highlights: ['Sagrada Família timed entry', 'Sunset on Barceloneta', 'Gothic Quarter wander'],
        planner: 'Barcelona',
        rating: '4.7',
        travelers: '17.4k travelers',
        price: '$1,180',
        keywords: 'barcelona spain gaudi tapas beach'
    },
    santorini: {
        title: 'Santorini, Greece',
        meta: '4.9 rating · 14.1k travelers · from $1,620 / week',
        image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&h=520&fit=crop',
        desc: 'Caldera views, whitewashed villages, and slow ferry days between islands.',
        facts: ['Island', 'Romance', 'Views'],
        highlights: ['Oia sunset from a side street', 'Hike Fira to Oia', 'Black-sand beach afternoon'],
        planner: 'Santorini',
        rating: '4.9',
        travelers: '14.1k travelers',
        price: '$1,620',
        keywords: 'santorini greece oia caldera island'
    },
    dubai: {
        title: 'Dubai, UAE',
        meta: '4.6 rating · 21.3k travelers · from $1,540 / week',
        image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&h=520&fit=crop',
        desc: 'Desert, skyline, and souks. Mix malls with a dune evening and old Dubai creek.',
        facts: ['City', 'Desert', 'Luxury'],
        highlights: ['Burj Khalifa at dusk', 'Al Fahidi neighborhood', 'Desert safari sunset'],
        planner: 'Dubai',
        rating: '4.6',
        travelers: '21.3k travelers',
        price: '$1,540',
        keywords: 'dubai uae burj desert marina'
    },
    iceland: {
        title: 'Reykjavík & Ring Road',
        meta: '4.8 rating · 11.6k travelers · from $1,890 / week',
        image: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=800&h=520&fit=crop',
        desc: 'Waterfalls, black beaches, and long summer light. Best with a rental car on the ring road.',
        facts: ['Nature', 'Adventure', 'Scenic'],
        highlights: ['Golden Circle day', 'Skógafoss and Reynisfjara', 'Blue Lagoon or Sky Lagoon'],
        planner: 'Iceland',
        rating: '4.8',
        travelers: '11.6k travelers',
        price: '$1,890',
        keywords: 'iceland reykjavik ring road waterfall northern lights'
    },
    kyoto: {
        title: 'Kyoto, Japan',
        meta: '4.9 rating · 15.8k travelers · from $1,390 / week',
        image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=520&fit=crop',
        desc: 'Temples, tea houses, and bamboo groves. Pair with Osaka for food nights.',
        facts: ['Culture', 'Temples', 'Food'],
        highlights: ['Fushimi Inari early morning', 'Arashiyama bamboo', 'Gion evening stroll'],
        planner: 'Kyoto',
        rating: '4.9',
        travelers: '15.8k travelers',
        price: '$1,390',
        keywords: 'kyoto japan temples bamboo gion'
    },
    nyc: {
        title: 'New York, USA',
        meta: '4.7 rating · 28.4k travelers · from $1,720 / week',
        image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&h=520&fit=crop',
        desc: 'Neighborhoods, museums, and late-night food. Walk, subway, then day-trip upstate.',
        facts: ['City', 'Food', 'Art'],
        highlights: ['Central Park loop', 'Brooklyn waterfront sunset', 'Museum mile or MoMA'],
        planner: 'New York',
        rating: '4.7',
        travelers: '28.4k travelers',
        price: '$1,720',
        keywords: 'new york nyc usa manhattan brooklyn'
    },
    marrakech: {
        title: 'Marrakech, Morocco',
        meta: '4.6 rating · 12.9k travelers · from $980 / week',
        image: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=800&h=520&fit=crop',
        desc: 'Riads, souks, and Atlas day trips. Hire a driver for the mountains; wander the medina on foot.',
        facts: ['Culture', 'Markets', 'Desert'],
        highlights: ['Jamaa el-Fna at dusk', 'Majorelle Garden', 'Atlas villages day trip'],
        planner: 'Marrakech',
        rating: '4.6',
        travelers: '12.9k travelers',
        price: '$980',
        keywords: 'marrakech morocco medina souk atlas'
    },
    sydney: {
        title: 'Sydney, Australia',
        meta: '4.8 rating · 16.2k travelers · from $1,510 / week',
        image: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&h=520&fit=crop',
        desc: 'Harbour walks, beaches, and ferries. Bondi to Coogee is the classic coastal day.',
        facts: ['Beach', 'City', 'Outdoors'],
        highlights: ['Opera House and Circular Quay', 'Bondi to Coogee walk', 'Ferry to Manly'],
        planner: 'Sydney',
        rating: '4.8',
        travelers: '16.2k travelers',
        price: '$1,510',
        keywords: 'sydney australia harbour opera bondi'
    },
    yosemite: {
        title: 'Yosemite National Park',
        meta: '4.9 rating · National Park · 180 miles away',
        image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&h=520&fit=crop',
        desc: 'Granite cliffs, waterfalls, and valley views. Best with a rental car for trailheads and park loops.',
        facts: ['National Park', 'Hiking', 'Scenic'],
        highlights: ['Tunnel View at sunrise', 'Mist Trail to Vernal Fall', 'Glacier Point if roads are open'],
        planner: 'Yosemite',
        rating: '4.9',
        travelers: 'Nearby · park',
        price: 'Day trip',
        keywords: 'yosemite national park hiking california granite'
    },
    tahoe: {
        title: 'Lake Tahoe',
        meta: '4.8 rating · Lake & Mountains · 95 miles away',
        image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=520&fit=crop',
        desc: 'Alpine lake for swimming, hiking, and winter sports. A car or SUV makes it easy to hop between north and south shores.',
        facts: ['Lake', 'Mountains', 'Outdoors'],
        highlights: ['Emerald Bay overlook', 'East shore beaches', 'Tahoe Rim Trail day hike'],
        planner: 'Lake Tahoe',
        rating: '4.8',
        travelers: 'Nearby · lake',
        price: 'Weekend',
        keywords: 'tahoe lake mountains california nevada'
    },
    bigsur: {
        title: 'Big Sur Coastline',
        meta: '4.7 rating · Scenic Drive · 120 miles away',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=520&fit=crop',
        desc: 'Pacific cliffs and Highway 1 pullouts. Rent a car and leave extra time for fog, traffic, and photo stops.',
        facts: ['Scenic Drive', 'Coast', 'Photography'],
        highlights: ['Bixby Creek Bridge', 'McWay Falls', 'Pfeiffer Beach if conditions allow'],
        planner: 'Big Sur',
        rating: '4.7',
        travelers: 'Nearby · coast',
        price: 'Day trip',
        keywords: 'big sur coastline highway 1 california pacific'
    }
};

function destinationSearchBlob(key, dest) {
    return [key, dest.title, dest.desc, dest.facts.join(' '), dest.keywords || '', dest.planner]
        .join(' ')
        .toLowerCase();
}

function findDestinations(query) {
    const q = String(query || '').trim().toLowerCase();
    const keys = Object.keys(DESTINATIONS);
    if (!q) return keys;
    return keys.filter((key) => destinationSearchBlob(key, DESTINATIONS[key]).includes(q));
}

function resolveDestinationKey(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return null;
    if (DESTINATIONS[q]) return q;
    const matches = findDestinations(q);
    if (matches.length === 1) return matches[0];
    const titled = matches.find((key) => DESTINATIONS[key].title.toLowerCase().startsWith(q) || key === q);
    return titled || matches[0] || null;
}

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

window.RoamitraDestinations = {
    DESTINATIONS,
    renderDestination,
    findDestinations,
    resolveDestinationKey
};

document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.dataset.destinationPage) return;
    const key = (new URLSearchParams(location.search).get('place') || 'bali').toLowerCase();
    renderDestination(key);
});
