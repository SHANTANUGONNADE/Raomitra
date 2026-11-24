'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = path.join(os.tmpdir(), 'roamitra-trip-api-test-' + process.pid);
if (fs.existsSync(temp)) throw new Error('Temporary test directory already exists.');
fs.mkdirSync(temp);
process.env.TEMP = temp;
process.env.TMP = temp;
process.env.TMPDIR = temp;

if (os.tmpdir() !== temp) {
    fs.rmdirSync(temp);
    throw new Error('Node did not use the isolated temporary test directory.');
}

const storePath = path.join(temp, 'raomitra-store.json');
const handle = require('../api');

function request(method, route, body, cookie) {
    const req = {
        method,
        url: '/api?r=' + encodeURIComponent(route),
        headers: Object.assign({ host: 'localhost' }, cookie ? { cookie } : {}),
        body,
        socket: {},
    };
    const res = {
        headers: {},
        setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
        end(value) { this.body = value; },
    };
    return Promise.resolve(handle(req, res)).then(() => ({
        status: res.statusCode,
        headers: res.headers,
        data: JSON.parse(res.body || '{}'),
    }));
}

(async () => {
    try {
        const email = 'trip-' + process.pid + '@example.test';
        const registered = await request('POST', '/auth/register', {
            full_name: 'Trip API Test',
            email,
            password: 'TripApiTest123!',
        });
        assert.equal(registered.status, 200);

        const login = await request('POST', '/auth/login', { email, password: 'TripApiTest123!' });
        assert.equal(login.status, 200);
        const cookie = login.headers['set-cookie'].split(';')[0];

        const created = await request('POST', '/trips', {
            destination: 'Tokyo',
            start_date: '2026-12-01',
            end_date: '2026-12-03',
            traveling_with: 'solo',
            arrival_time: '10:00',
            departure_time: '14:00',
            preferences: ['food'],
            pace: 'moderate',
        }, cookie);
        assert.equal(created.status, 201);

        const tripId = created.data.trip.id;
        const updated = await request('POST', '/trips/' + tripId + '/update', {
            destination: 'Tokyo',
            start_date: '2026-12-01',
            end_date: '2026-12-03',
            traveling_with: 'solo',
            arrival_time: '11:30',
            departure_time: '15:45',
            preferences: ['food'],
            pace: 'packed',
        }, cookie);
        assert.equal(updated.status, 200);
        assert.equal(updated.data.trip.arrival_time, '11:30');
        assert.equal(updated.data.trip.departure_time, '15:45');
        assert.equal(updated.data.trip.pace, 'packed');

        const generated = await request('POST', '/trips/' + tripId + '/generate', {}, cookie);
        assert.equal(generated.status, 200);

        const beforeChat = await request('GET', '/trips/' + tripId, null, cookie);
        assert.equal(beforeChat.status, 200);
        assert.equal(beforeChat.data.trip.arrival_time, '11:30');
        assert.equal(beforeChat.data.trip.departure_time, '15:45');
        assert.equal(beforeChat.data.trip.pace, 'packed');
        assert(beforeChat.data.itinerary);

        const chat = await request('POST', '/trips/' + tripId + '/assistant', {
            message: 'Change timings to start later in the morning',
        }, cookie);
        assert.equal(chat.status, 200);
        assert(chat.data.reply);

        const afterChat = await request('GET', '/trips/' + tripId, null, cookie);
        assert.equal(afterChat.status, 200);
        assert.equal(afterChat.data.itinerary.version, 2);
        assert(afterChat.data.messages.some((item) => item.role === 'user'));
        assert(afterChat.data.messages.some((item) => item.role === 'assistant' && item.message === chat.data.reply));

        console.log('Trip API itinerary chat test passed.');
    } finally {
        if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
        fs.rmdirSync(temp);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
