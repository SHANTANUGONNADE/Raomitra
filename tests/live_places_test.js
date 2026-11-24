'use strict';

const assert = require('node:assert/strict');
const livePlaces = require('../api/live-places');

const requests = [];
global.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).startsWith('https://nominatim.openstreetmap.org/')) {
        return { ok: true, json: async () => [{ lat: '64.1466', lon: '-21.9426' }] };
    }
    if (String(url).startsWith('https://overpass-api.de/')) {
        return { ok: false, status: 503, json: async () => ({}) };
    }
    if (String(url).startsWith('https://overpass.kumi.systems/')) {
        return {
            ok: true,
            json: async () => ({
                elements: [
                    {
                        type: 'node',
                        id: 401,
                        lat: 64.1466,
                        lon: -21.9426,
                        tags: { name: 'Hallgrímskirkja', tourism: 'attraction' },
                    },
                    {
                        type: 'node',
                        id: 402,
                        lat: 64.147,
                        lon: -21.943,
                        tags: { name: 'Test Guest House', tourism: 'guest_house' },
                    },
                ],
            }),
        };
    }
    throw new Error('Unexpected request: ' + url);
};

(async () => {
    const data = await livePlaces.forDestination('Reykjavik, Iceland');
    assert.equal(data.source, 'OpenStreetMap');
    assert.equal(data.activities[0].name, 'Hallgrímskirkja');
    assert.equal(data.stays[0].name, 'Test Guest House');
    assert(requests.some((url) => url.startsWith('https://overpass-api.de/')));
    assert(requests.some((url) => url.startsWith('https://overpass.kumi.systems/')));
    const requestCount = requests.length;
    const cachedData = await livePlaces.forDestination('Reykjavik, Iceland');
    assert.equal(cachedData.source, 'OpenStreetMap');
    assert.equal(requests.length, requestCount);
    console.log('Live place provider failover test passed.');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
