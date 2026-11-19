'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = path.join(os.tmpdir(), 'roamitra-local-feed-test-' + process.pid);
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
        const email = 'feed-' + process.pid + '@example.test';
        const cityChat = await request('POST', '/roamini/chat', { message: 'Mumbai locations' });
        assert.equal(cityChat.status, 200);
        assert.match(cityChat.data.reply, /Marine Drive/);

        const registered = await request('POST', '/auth/register', {
            full_name: 'Local Feed Test',
            email,
            password: 'LocalFeedTest123!',
        });
        assert.equal(registered.status, 200);

        const login = await request('POST', '/auth/login', { email, password: 'LocalFeedTest123!' });
        assert.equal(login.status, 200);
        const cookie = login.headers['set-cookie'].split(';')[0];

        const unauthorized = await request('POST', '/local/feeds', {
            category: 'food',
            title: 'Test tip',
            body: 'Test body',
        });
        assert.equal(unauthorized.status, 401);

        const created = await request('POST', '/local/feeds', {
            category: 'food',
            title: 'Test tip',
            body: 'Test body',
            place: 'Mumbai',
        }, cookie);
        assert.equal(created.status, 201);
        assert.equal(created.data.feed.title, 'Test tip');

        const listed = await request('GET', '/local/feeds');
        assert(listed.data.feeds.some((feed) => feed.id === created.data.feed.id));

        const deleted = await request('POST', '/local/feeds/' + created.data.feed.id + '/delete', {}, cookie);
        assert.equal(deleted.status, 200);
        const afterDelete = await request('GET', '/local/feeds');
        assert(!afterDelete.data.feeds.some((feed) => feed.id === created.data.feed.id));

        console.log('Local feed API tests passed.');
    } finally {
        if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
        fs.rmdirSync(temp);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
