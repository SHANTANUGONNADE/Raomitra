'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const context = {
    console,
    document: { addEventListener() {} },
    AbortController,
    URLSearchParams,
    setTimeout,
    clearTimeout,
};
context.window = context;
vm.createContext(context);

for (const file of [
    'public/assets/js/india-cities.js',
    'public/assets/js/destination.js',
    'public/assets/js/place-images.js',
]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
}

const destinations = context.RoamitraDestinations;
assert.ok(destinations);
assert.equal(
    destinations.findPlaceImage('India Gate', 'Delhi'),
    destinations.DESTINATIONS.indiagate.image
);
assert.equal(
    destinations.findPlaceImage('Diwan-I-Am', 'Delhi'),
    destinations.DESTINATIONS.diwaniamnewdelhi.image
);
assert.equal(
    destinations.findPlaceImage('Diwan-I-Am', 'Agra'),
    destinations.DESTINATIONS.diwaniam.image
);
assert.equal(destinations.findPlaceImage('Unknown Place', 'Delhi'), '');
assert.ok(destinations.findCityImage('Delhi'));

async function run() {
    const placeImages = context.RoamitraPlaceImages;
    const indiaGateImage = destinations.findPlaceImage('India Gate', 'Delhi');

    assert.equal(placeImages.forActivity({ title: 'India Gate' }, 'Delhi'), indiaGateImage);
    assert.equal(
        placeImages.forActivity({ title: 'Unknown Place', image: 'https://images.unsplash.com/photo-random' }, 'Mysore'),
        ''
    );
    assert.equal(
        placeImages.forActivity({ title: 'Unknown Place', image: 'https://example.com/place.jpg' }, 'Mysore'),
        'https://example.com/place.jpg'
    );
    assert.equal(await placeImages.resolve({ title: 'India Gate' }, 'Delhi'), indiaGateImage);

    let requestedUrl = '';
    context.fetch = async (url) => {
        requestedUrl = url;
        return {
            ok: true,
            json: async () => ({
                query: {
                    pages: {
                        1: {
                            title: 'Xylophonia Observatory',
                            thumbnail: { source: 'https://upload.wikimedia.org/xylophonia.jpg' },
                        },
                    },
                },
            }),
        };
    };
    assert.equal(
        await placeImages.resolve({ title: 'Xylophonia Observatory' }, 'Xylophonia'),
        'https://upload.wikimedia.org/xylophonia.jpg'
    );
    assert.match(requestedUrl, /Xylophonia\+Observatory\+Xylophonia/);
}

run().then(() => {
    console.log('Destination image lookup tests passed.');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
