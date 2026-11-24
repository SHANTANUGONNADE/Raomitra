'use strict';

const CACHE_MS = 60 * 60 * 1000;
const cache = new Map();
let nominatimQueue = Promise.resolve();
let lastNominatimRequest = 0;

function providerError(message, cause) {
    const error = new Error(message);
    error.status = 503;
    if (cause) error.cause = cause;
    return error;
}

async function fetchJson(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
        if (!response.ok) throw new Error('Place provider returned HTTP ' + response.status + '.');
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

function coordinates(element) {
    const point = element.type === 'node' ? element : (element.center || {});
    const lat = Number(point.lat);
    const lon = Number(point.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

function classify(tags) {
    if (tags.tourism && ['hotel', 'hostel', 'guest_house', 'motel', 'apartment', 'chalet', 'alpine_hut'].includes(tags.tourism)) {
        return 'accommodation';
    }
    if (tags.amenity === 'cafe') return 'cafe';
    if (tags.amenity === 'restaurant' || tags.amenity === 'food_court') return 'restaurant';
    if (tags.amenity === 'marketplace' || tags.shop === 'market') return 'market';
    if (tags.tourism === 'museum' || tags.tourism === 'gallery') return 'museum';
    if (tags.tourism === 'viewpoint' || tags.historic) return 'landmark';
    if (tags.amenity === 'place_of_worship') return 'temple';
    if (tags.leisure === 'park' || tags.leisure === 'nature_reserve') return 'nature';
    if (tags.tourism === 'attraction' || tags.tourism === 'artwork' || tags.tourism === 'zoo' || tags.tourism === 'aquarium') return 'culture';
    return '';
}

function mapElement(element, destination) {
    const tags = element.tags || {};
    const location = coordinates(element);
    const name = String(tags.name || tags['name:en'] || '').trim();
    const category = classify(tags);
    if (!name || !category || !location) return null;

    const mapQuery = encodeURIComponent(name + ', ' + (tags['addr:city'] || destination));
    const osmUrl = element.type && element.id
        ? 'https://www.openstreetmap.org/' + encodeURIComponent(element.type) + '/' + Number(element.id)
        : 'https://www.openstreetmap.org/?mlat=' + location.lat + '&mlon=' + location.lon + '#map=17/' + location.lat + '/' + location.lon;

    return {
        id: element.type + '/' + Number(element.id),
        name,
        category,
        lat: location.lat,
        lon: location.lon,
        address: [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', '),
        opening_hours: String(tags.opening_hours || ''),
        fee: String(tags.fee || ''),
        charge: String(tags.charge || ''),
        tourism_type: String(tags.tourism || ''),
        map_url: 'https://www.google.com/maps/search/?api=1&query=' + mapQuery,
        osm_url: osmUrl,
    };
}

function offlineGuide(destination) {
    if (!/\bmumbai\b/i.test(String(destination || ''))) return null;
    const places = [
        ['Gateway of India', 'landmark'],
        ['Marine Drive', 'city'],
        ['Juhu Beach', 'beach'],
        ['Chhatrapati Shivaji Terminus', 'landmark'],
    ];
    const activities = places.map(([name, category], index) => ({
        id: 'guide/mumbai-' + (index + 1),
        name,
        category,
        address: 'Mumbai, Maharashtra',
        opening_hours: '',
        fee: 'no',
        charge: '',
        notes: 'Public place with no admission fee listed in the Roamitra city guide. Confirm access and local conditions before visiting.',
        map_url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ', Mumbai, India'),
        osm_url: '',
    }));
    return {
        activities,
        stays: [],
        source: 'Roamitra curated Mumbai guide',
        attribution_url: null,
        fetched_at: null,
    };
}

async function forDestination(destination) {
    const query = String(destination || '').trim();
    if (!query) throw providerError('Enter a destination to find real places.');
    const cacheKey = query.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    try {
        const geocodeTask = nominatimQueue.then(async () => {
            const delay = Math.max(0, 1000 - (Date.now() - lastNominatimRequest));
            if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
            lastNominatimRequest = Date.now();
            return fetchJson(
                'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(query),
                { headers: { 'User-Agent': 'RoamitraTravelPlanner/1.0', Accept: 'application/json' } },
                5000
            );
        });
        nominatimQueue = geocodeTask.then(() => undefined, () => undefined);
        const geocoded = await geocodeTask;
        if (!Array.isArray(geocoded) || !geocoded[0]) {
            throw providerError('No mapped location was found for "' + query + '". Try a city or nearby landmark.');
        }

        const lat = Number(geocoded[0].lat);
        const lon = Number(geocoded[0].lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            throw providerError('The destination could not be located. Try a more specific city name.');
        }
        const overpassQuery = [
            '[out:json][timeout:8];',
            '(',
            'nwr(around:12000,' + lat + ',' + lon + ')["tourism"~"attraction|museum|gallery|viewpoint|hotel|hostel|guest_house|motel|apartment|zoo|aquarium|artwork"];',
            'nwr(around:12000,' + lat + ',' + lon + ')["amenity"~"restaurant|cafe|food_court|marketplace|place_of_worship"];',
            'nwr(around:12000,' + lat + ',' + lon + ')["historic"];',
            'nwr(around:12000,' + lat + ',' + lon + ')["leisure"~"park|nature_reserve"];',
            ');out center tags 120;',
        ].join('');
        const result = await fetchJson(
            'https://overpass-api.de/api/interpreter',
            {
                method: 'POST',
                headers: {
                    'User-Agent': 'RoamitraTravelPlanner/1.0',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                },
                body: 'data=' + encodeURIComponent(overpassQuery),
            },
            10000
        );

        const places = (Array.isArray(result.elements) ? result.elements : [])
            .map((element) => mapElement(element, query))
            .filter(Boolean);
        const unique = [...new Map(places.map((place) => [place.name.toLowerCase(), place])).values()];
        const activities = unique.filter((place) => place.category !== 'accommodation');
        const stays = unique.filter((place) => place.category === 'accommodation');
        if (!activities.length) {
            throw providerError('No mapped attractions or businesses were found near "' + query + '". Try a larger nearby city.');
        }

        const data = {
            activities,
            stays,
            source: 'OpenStreetMap',
            attribution_url: 'https://www.openstreetmap.org/copyright',
            fetched_at: new Date().toISOString(),
        };
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_MS });
        return data;
    } catch (error) {
        if (cached) {
            return Object.assign({}, cached.data, {
                source: 'OpenStreetMap (cached)',
                is_stale: true,
            });
        }
        const guide = offlineGuide(query);
        if (guide) return guide;
        if (error.status) throw error;
        throw providerError('Live place data is temporarily unavailable. Please try generating the itinerary again.', error);
    }
}

module.exports = { forDestination };
