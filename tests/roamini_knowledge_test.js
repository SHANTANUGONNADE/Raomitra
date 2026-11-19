'use strict';

const assert = require('node:assert/strict');
const { retrieve } = require('../api/roamini-knowledge');

const swimming = retrieve('Can I swim at Juhu Beach?');
assert.equal(swimming.has_relevant, true);
assert.match(swimming.context, /Juhu Beach/);
assert.match(swimming.context, /Approved example/);

const hinglish = retrieve('Bandra mein sasta khana kahan milega?');
assert.equal(hinglish.has_relevant, true);

const followUp = retrieve('Something closer to the station', [
    { role: 'user', content: 'I have a few hours near CSMT before my train.' },
]);
assert.equal(followUp.has_relevant, true);
assert.match(followUp.context, /CSMT/);

const general = retrieve('What is photosynthesis?');
assert.equal(general.has_relevant, false);

const mumbai = require('../api/roamini-knowledge').cityLocationsAnswer('mumbai locations');
assert.match(mumbai, /Popular places in Mumbai/);
assert.match(mumbai, /Gateway of India/);
assert.match(mumbai, /Marine Drive/);

const cityOnly = require('../api/roamini-knowledge').cityLocationsAnswer('Mumbai');
assert.match(cityOnly, /Popular places in Mumbai/);

const bombay = require('../api/roamini-knowledge').cityLocationsAnswer('Bombay places');
assert.match(bombay, /Popular places in Mumbai/);

const abuRoad = require('../api/roamini-knowledge').cityLocationsAnswer('Abu Road');
assert.match(abuRoad, /Achalgarh Fort/);

const agra = require('../api/roamini-knowledge').cityLocationsAnswer('Agra locations');
assert.match(agra, /Popular places in Agra/);

console.log('Roamini knowledge retrieval tests passed.');
