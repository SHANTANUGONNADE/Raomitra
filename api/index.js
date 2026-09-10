'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const bcrypt = require('bcryptjs');
const mysqlStore = require('./mysql');

const SECRET = process.env.RAOMITRA_SESSION_SECRET || 'raomitra-local-session-key';
const COOKIE = 'raomitra_auth';
const STORE = path.join(require('os').tmpdir(), 'raomitra-store.json');
const SALT = 'raomitra-v1';

function nowIso() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function hashPassword(password) {
    return bcrypt.hashSync(String(password), 10);
}

function verifyPassword(password, hash) {
    if (!hash) return false;
    if (hash.startsWith('$2y$') || hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
        return bcrypt.compareSync(String(password), hash.replace(/^\$2y\$/, '$2a$'));
    }
    return hash === crypto.scryptSync(String(password), SALT, 32).toString('hex');
}

function normalizeRole(role) {
    const value = String(role || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (['admin', 'administrator', 'superadmin', 'super_admin'].includes(value)) return 'admin';
    if (['co_admin', 'coadmin', 'co_administrator'].includes(value)) return 'co_admin';
    if (['host', 'vendor', 'owner'].includes(value)) return 'host';
    return 'customer';
}

function publicUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: normalizeRole(user.role),
        avatar_url: user.avatar_url || null,
        cover_url: user.cover_url || null,
        bio: user.bio || '',
        location: user.location || '',
        created_at: user.created_at,
    };
}

function emptyDb() {
    const created = nowIso();
    const admin = {
        id: 1,
        full_name: 'Roamitra Admin',
        email: 'admin@raomitra.com',
        password_hash: hashPassword('Admin1234!'),
        role: 'admin',
        avatar_url: null,
        created_at: created,
    };
    return {
        nextId: 2,
        users: [admin],
        wallets: [{ id: 1, user_id: 1, balance: 0, currency: 'USD', updated_at: created }],
        wallet_transactions: [],
        trips: [],
        itineraries: [],
        itinerary_messages: [],
        notifications: [{
            id: 1,
            user_id: 1,
            type: 'community',
            title: 'Welcome to Roamitra',
            body: 'Admin dashboard is ready.',
            link: 'admin.html',
            is_read: 0,
            created_at: created,
        }],
        translator_history: [],
        translator_prefs: [],
        community_posts: [],
        community_replies: [],
        host_applications: [],
        vehicle_bookings: [],
    };
}

function loadDb() {
    try {
        const raw = fs.readFileSync(STORE, 'utf8');
        const db = JSON.parse(raw);
        if (!db.users) return emptyDb();
        return db;
    } catch (e) {
        const db = emptyDb();
        saveDb(db);
        return db;
    }
}

function saveDb(db) {
    fs.writeFileSync(STORE, JSON.stringify(db));
}

function addRow(db, table, row) {
    const id = db.nextId++;
    const item = Object.assign({ id }, row);
    db[table].push(item);
    return item;
}

function notify(db, userId, type, title, body, link) {
    addRow(db, 'notifications', {
        user_id: userId,
        type,
        title,
        body: body || '',
        link: link || null,
        is_read: 0,
        created_at: nowIso(),
    });
}

function notifyStaff(db, type, title, body, link) {
    db.users.filter((u) => u.role === 'admin' || u.role === 'co_admin').forEach((u) => {
        notify(db, u.id, type, title, body, link);
    });
}

function ensureWallet(db, userId) {
    let wallet = db.wallets.find((w) => w.user_id === userId);
    if (!wallet) {
        wallet = addRow(db, 'wallets', {
            user_id: userId,
            balance: 0,
            currency: 'USD',
            updated_at: nowIso(),
        });
    }
    return wallet;
}

function sign(payload) {
    const json = JSON.stringify(payload);
    const b64 = Buffer.from(json).toString('base64url');
    const sig = crypto.createHmac('sha256', SECRET).update(json).digest('hex');
    return b64 + '.' + sig;
}

function unsign(token) {
    if (!token || !token.includes('.')) return null;
    const [b64, sig] = token.split('.');
    let json;
    try {
        json = Buffer.from(b64, 'base64url').toString('utf8');
    } catch (e) {
        return null;
    }
    const expect = crypto.createHmac('sha256', SECRET).update(json).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        return JSON.parse(json);
    } catch (e) {
        return null;
    }
}

function parseCookies(req) {
    const header = req.headers.cookie || '';
    const out = {};
    header.split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return;
        out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    });
    return out;
}

function setAuthCookie(res, user, extra = []) {
    const token = sign({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        password_hash: user.password_hash,
    });
    extra.push(
        `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`
    );
    res.setHeader('Set-Cookie', extra);
}

function clearAuthCookie(res) {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function restoreUser(db, token) {
    if (!token || !token.email) return null;
    let user = db.users.find((u) => u.email === token.email);
    if (!user) {
        user = {
            id: token.id || db.nextId++,
            full_name: token.full_name || 'Member',
            email: token.email,
            password_hash: token.password_hash || hashPassword(crypto.randomBytes(8).toString('hex')),
            role: token.role || 'customer',
            avatar_url: null,
            created_at: nowIso(),
        };
        if (!db.users.some((u) => u.id === user.id)) {
            db.users.push(user);
        }
        ensureWallet(db, user.id);
        saveDb(db);
    }
    return user;
}

async function currentUser(req, db) {
    const token = unsign(parseCookies(req)[COOKIE]);
    if (!token) return null;
    if (mysqlStore.isConfigured() && token.email) {
        const row = await mysqlStore.findUserByEmail(token.email);
        if (row) {
            row.role = normalizeRole(row.role);
            return row;
        }
        return null;
    }
    const user = restoreUser(db, token);
    if (user) user.role = normalizeRole(user.role);
    return user;
}

function send(res, status, data) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(Object.assign({ ok: status < 400 }, data)));
}

function fail(res, message, status) {
    send(res, status || 400, { ok: false, error: message });
}

async function readBody(req) {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        return req.body;
    }
    if (typeof req.body === 'string' && req.body) {
        try {
            return JSON.parse(req.body);
        } catch (e) {
            return {};
        }
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch (e) {
        return {};
    }
}

function requestUrl(req) {
    const host = req.headers.host || 'localhost';
    return new URL(req.url || '/', 'https://' + host);
}

function isNewUser(createdAt, days) {
    const created = new Date(String(createdAt || '').replace(' ', 'T'));
    if (Number.isNaN(created.getTime())) return false;
    return (Date.now() - created.getTime()) <= days * 86400000;
}

function listUsersFromStore(db, { filter = 'all', days = 7, q = '' } = {}) {
    const safeDays = Math.max(1, Math.min(90, Number(days) || 7));
    const search = String(q || '').trim().toLowerCase();
    let users = db.users.slice();
    const total = users.length;
    const newCount = users.filter((u) => isNewUser(u.created_at, safeDays)).length;
    if (filter === 'new') {
        users = users.filter((u) => isNewUser(u.created_at, safeDays));
    }
    if (search) {
        users = users.filter((u) => {
            const name = String(u.full_name || '').toLowerCase();
            const email = String(u.email || '').toLowerCase();
            return name.includes(search) || email.includes(search);
        });
    }
    users.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return {
        users: users.map(publicUser),
        total,
        new_count: newCount,
        days: safeDays,
        filter: filter === 'new' ? 'new' : 'all',
    };
}

function routePath(req) {
    const url = requestUrl(req);
    let r = url.searchParams.get('r') || '';
    if (!r) {
        const pathname = url.pathname.replace(/\/+$/, '');
        const match = pathname.match(/\/api(?:\/index\.js)?\/(.+)$/);
        if (match) r = match[1];
    }
    r = '/' + String(r).replace(/^\/+/, '');
    if (r === '/') r = '/health';
    return r;
}

function validName(name) {
    return /^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u.test(name);
}

function daysBetween(start, end) {
    const a = new Date(start + 'T00:00:00');
    const b = new Date(end + 'T00:00:00');
    return Math.max(1, Math.round((b - a) / 86400 / 1000) + 1);
}

function generateItinerary(trip) {
    const count = Math.min(14, daysBetween(trip.start_date, trip.end_date));
    const days = [];
    for (let i = 0; i < count; i++) {
        const date = new Date(trip.start_date + 'T00:00:00');
        date.setDate(date.getDate() + i);
        const iso = date.toISOString().slice(0, 10);
        days.push({
            day: i + 1,
            date: iso,
            theme: i === 0 ? 'Arrival in ' + trip.destination : 'Explore ' + trip.destination,
            activities: [
                {
                    title: i === 0 ? 'Hotel check-in' : 'Local sightseeing',
                    category: i === 0 ? 'accommodation' : 'culture',
                    start: '09:00',
                    end: '11:00',
                    cost: i === 0 ? 0 : 25,
                    notes: 'Planned for ' + trip.destination,
                },
                {
                    title: 'Lunch & neighborhood walk',
                    category: 'food',
                    start: '12:30',
                    end: '14:00',
                    cost: 20,
                    notes: 'Casual local meal',
                },
            ],
        });
    }
    return {
        destination: trip.destination,
        version: 1,
        generated_at: new Date().toISOString(),
        days,
        summary: 'A ' + count + '-day plan for ' + trip.destination + '.',
        budget: {
            user_budget: trip.budget,
            currency: trip.budget_currency || 'USD',
            estimated_total: count * 80,
        },
    };
}

async function roaminiChat(message, history) {
    const q = String(message || '').trim();
    if (!q) return 'Ask me anything — travel, Roamitra, or a general question — and I will answer.';
    let lower = q.toLowerCase().replace(/[-_]/g, ' ');
    lower = lower.replace(/\bsigin\b/g, 'sign in').replace(/\bsignin\b/g, 'sign in').replace(/\bsignup\b/g, 'sign up').replace(/\blog in\b/g, 'login');
    if (/^(hi|hello|hey|yo|namaste|good morning|good afternoon|good evening)\b/i.test(q)) {
        return 'Hello! I am Roamini, your Roamitra assistant. Ask me about destinations, Ask to Rent, Ask to Host, trip planning, or how to use the site.';
    }
    if (/what( is|'s)? (your )?name|who are you/i.test(lower)) {
        return 'I am Roamini, the travel assistant on Roamitra. I help with destinations, bookings, hosts, meetups, and how to use the site.';
    }
    if (/\b(log ?in|sign ?in|sigin|signin|login)\b/i.test(q) || lower.includes('sign in')) {
        return 'To sign in to Roamitra: click Log in at the top right, enter the email and password you used to sign up, then submit. If you do not have an account yet, click Sign up first. After you are logged in you can book rentals, plan trips, and use Community.';
    }
    if (lower.includes('sign up') || lower.includes('register') || lower.includes('create account')) {
        return 'To create a Roamitra account: click Sign up at the top right, enter your name, email, and password, then submit. Then use Log in with the same email.';
    }
    if (lower.includes('become a host') || lower.includes('ask to host')) {
        return 'To become a host, log in and open Ask to Host. Submit your city, phone, and a short bio. After admin approval you get a verified host badge and can welcome travelers.';
    }
    if (lower.includes('ask to rent') || lower.includes('booking') || lower.includes('rent a')) {
        return 'Open Community → Ask to Rent, pick a vehicle, then Book Now. Choose pickup and return dates. You need to be logged in.';
    }
    if (lower.includes('meetup')) {
        return 'Meetups are group activities with other travelers. Open Community → Meetups to find events in your city.';
    }
    if (lower.includes('cancel')) {
        return 'Most Roamitra bookings can be cancelled up to 48 hours before for a full refund. Check the listing for vehicle and meetup terms.';
    }
    if (lower.includes('bali')) {
        return 'Bali is a tropical favorite: temples, rice terraces, beaches, and Ubud culture. Explore packages often start around $1,200/week. Ask to Rent for scooters and connect with locals for tips.';
    }
    if (lower.includes('destination') || lower.includes('where should i go') || lower.includes('recommend')) {
        return 'Popular Roamitra picks include Bali, Tokyo, Paris, Rome, Barcelona, Santorini, Dubai, Iceland, Kyoto, New York, Marrakech, Sydney, Yosemite, Lake Tahoe, and Big Sur. Search Explore or tell me your budget and style.';
    }
    if (/^(how to|how do i|how can i|how do you)\b/i.test(lower)) {
        return 'On Roamitra you can: Log in / Sign up (top right), Explore destinations, Plan Trip for an itinerary, Community for questions, Ask to Rent vehicles, Ask to Host, and Meetups. Tell me which of those you want step-by-step.';
    }
    const openaiKey = process.env.OPENAI_API_KEY || '';
    if (openaiKey) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: 'You are Roamini, the helpful assistant for Roamitra. Answer any question clearly. Prefer practical travel advice when relevant. If the question is not about travel, still answer it. Keep replies under 180 words unless steps are needed.',
                },
            ];
            (Array.isArray(history) ? history.slice(-8) : []).forEach((turn) => {
                const role = turn && turn.role === 'assistant' ? 'assistant' : 'user';
                const content = String((turn && turn.content) || '').trim();
                if (content) messages.push({ role, content });
            });
            messages.push({ role: 'user', content: q });
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + openaiKey,
                },
                body: JSON.stringify({
                    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                    temperature: 0.5,
                    max_tokens: 500,
                    messages,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
                if (text && String(text).trim()) return String(text).trim();
            }
        } catch (e) { /* fall through */ }
    }
    const search = q.replace(/[?!.]+/g, ' ').replace(/^(please |can you |could you |what is |what's |whats |who is |who's |tell me about |explain |define )/i, '').trim();
    const factual = /^(what|who|where|when|which|why)\b/i.test(q) || /\b(tell me about|explain|define)\b/i.test(q);
    if (!factual) {
        return 'On Roamitra: Log in / Sign up (top right), Explore, Plan Trip, Community, Ask to Rent, Ask to Host, and Meetups. For a place or topic, ask “what is Kyoto” or tell me the city you want help with.';
    }
    try {
        const wikiSearch = await fetch('https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&search=' + encodeURIComponent(search), {
            headers: { 'User-Agent': 'RoamitraRoamini/1.0' },
        });
        if (wikiSearch.ok) {
            const w = await wikiSearch.json();
            const title = w && w[1] && w[1][0];
            if (title) {
                const sumRes = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(String(title).replace(/ /g, '_')), {
                    headers: { 'User-Agent': 'RoamitraRoamini/1.0', Accept: 'application/json' },
                });
                if (sumRes.ok) {
                    const sum = await sumRes.json();
                    if (sum && sum.extract) return String(sum.extract);
                }
                if (w[2] && w[2][0]) return String(w[2][0]);
            }
        }
    } catch (e) { /* fall through */ }
    try {
        const ddg = await fetch('https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=' + encodeURIComponent(q));
        if (ddg.ok) {
            const data = await ddg.json();
            if (data.AbstractText) return String(data.AbstractText);
            if (data.Definition) return String(data.Definition);
            if (data.RelatedTopics && data.RelatedTopics[0] && data.RelatedTopics[0].Text) {
                return String(data.RelatedTopics[0].Text);
            }
        }
    } catch (e) { /* fall through */ }
    return 'Here is a useful take: tell me the city, dates, and whether you want stays, rentals, hosts, or an itinerary if this is travel. For a general topic, try a short phrase like “what is Kyoto”. Your question was: “' + q.slice(0, 180) + '”.';
}

async function translateText(text, source, target) {
    if (source === target) return text;
    const sl = source === 'autodetect' || source === 'auto' ? 'auto' : source;
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl='
        + encodeURIComponent(sl) + '&tl=' + encodeURIComponent(target) + '&dt=t&q=' + encodeURIComponent(text);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Translation service is unavailable. Try again shortly.');
    const data = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
        throw new Error('Translation service is unavailable. Try again shortly.');
    }
    const out = data[0].map((chunk) => (chunk && chunk[0] ? chunk[0] : '')).join('').trim();
    if (!out) throw new Error('Translation service is unavailable. Try again shortly.');
    return out;
}

function parseTripInput(input) {
    const destination = String(input.destination || '').trim();
    const start = String(input.start_date || '');
    const end = String(input.end_date || '');
    const withWho = String(input.traveling_with || 'solo');
    const arrival = String(input.arrival_time || '');
    const departure = String(input.departure_time || '');
    let pace = String(input.pace || 'moderate');
    let prefs = input.preferences || [];
    if (!Array.isArray(prefs)) prefs = [];
    if (!destination || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        throw new Error('Destination, start date, and end date are required.');
    }
    if (end < start) throw new Error('Departure date must be on or after arrival date.');
    const WITH = ['solo', 'couple', 'family', 'friends', 'group'];
    const TIMES = ['morning', 'afternoon', 'evening', 'late_night'];
    if (!WITH.includes(withWho)) throw new Error('Choose who you are traveling with.');
    if (!TIMES.includes(arrival) || !TIMES.includes(departure)) {
        throw new Error('Select arrival and departure times.');
    }
    if (!['relaxed', 'moderate', 'packed'].includes(pace)) pace = 'moderate';
    let groupSize = null;
    if (withWho === 'group') {
        const raw = String(input.group_size || '');
        groupSize = raw === '10+' ? 10 : parseInt(raw, 10);
        if (!groupSize || groupSize < 3 || groupSize > 12) {
            throw new Error('Select how many people are traveling (3 to 10+).');
        }
    } else {
        groupSize = withWho === 'couple' ? 2 : (withWho === 'family' || withWho === 'friends' ? 4 : 1);
    }
    let budget = input.budget;
    if (budget === '' || budget == null) budget = null;
    else {
        budget = Number(budget);
        if (budget < 0) throw new Error('Budget cannot be negative.');
    }
    return {
        destination,
        start_date: start,
        end_date: end,
        budget,
        budget_currency: 'USD',
        traveling_with: withWho,
        group_size: groupSize,
        arrival_time: arrival,
        departure_time: departure,
        preferences: prefs.map(String).filter(Boolean),
        pace,
    };
}

function ownedTrip(db, id, userId) {
    const trip = db.trips.find((t) => t.id === id && t.user_id === userId);
    if (!trip) {
        const err = new Error('Trip not found.');
        err.status = 404;
        throw err;
    }
    return trip;
}

function currentItinerary(db, tripId) {
    const rows = db.itineraries.filter((i) => i.trip_id === tripId && i.is_current).sort((a, b) => b.version - a.version);
    const row = rows[0];
    if (!row) return null;
    const data = typeof row.itinerary_json === 'string' ? JSON.parse(row.itinerary_json) : row.itinerary_json;
    return Object.assign({}, data, {
        id: row.id,
        version: row.version,
        summary: row.summary,
        created_at: row.created_at,
    });
}

async function handle(req, res) {
    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    const db = loadDb();
    const method = req.method || 'GET';
    const p = routePath(req);
    let input = {};
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
        input = await readBody(req);
    }

    const needUser = async () => {
        const user = await currentUser(req, db);
        if (!user) {
            const err = new Error('Please log in to continue.');
            err.status = 401;
            throw err;
        }
        return user;
    };

    try {
        if (method === 'GET' && (p === '/health' || p === '/')) {
            return send(res, 200, {
                ok: true,
                service: 'roamitra',
                driver: 'vercel-node',
                storage: mysqlStore.storageLabel(),
            });
        }

        if (method === 'POST' && p === '/auth/register') {
            const name = String(input.full_name || '').replace(/\s+/g, ' ').trim();
            const email = String(input.email || '').trim().toLowerCase();
            const password = String(input.password || '');
            const confirm = String(input.confirm_password || password);
            if (!name || !validName(name)) {
                return fail(res, 'Full name can contain letters only (spaces, hyphens, and apostrophes are allowed).');
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 'Enter a valid email address.');
            if (password.length < 8) return fail(res, 'Password must be at least 8 characters.');
            if (password !== confirm) return fail(res, 'Passwords do not match.');
            const passwordHash = hashPassword(password);
            if (mysqlStore.isConfigured()) {
                try {
                    if (await mysqlStore.findUserByEmail(email)) {
                        return fail(res, 'An account with this email already exists.', 409);
                    }
                    await mysqlStore.createUser({
                        full_name: name,
                        email,
                        password_hash: passwordHash,
                        role: 'customer',
                    });
                } catch (err) {
                    return fail(res, 'Database unavailable: ' + err.message, 500);
                }
                return send(res, 200, { ok: true, registered: true, message: 'Signup successfully. Please log in to continue.' });
            }
            if (db.users.some((u) => u.email === email)) {
                return fail(res, 'An account with this email already exists.', 409);
            }
            const user = addRow(db, 'users', {
                full_name: name,
                email,
                password_hash: passwordHash,
                role: 'customer',
                avatar_url: null,
                created_at: nowIso(),
            });
            ensureWallet(db, user.id);
            notify(db, user.id, 'community', 'Welcome to Roamitra', 'Your account is ready. Plan a trip, join the community, or try the translator.', 'planner.html');
            saveDb(db);
            return send(res, 200, { ok: true, registered: true, message: 'Signup successfully. Please log in to continue.' });
        }

        if (method === 'POST' && p === '/auth/login') {
            const email = String(input.email || '').trim().toLowerCase();
            const password = String(input.password || '');
            if (!email || !password) return fail(res, 'Enter your email and password.');
            let row = mysqlStore.isConfigured() ? await mysqlStore.findUserByEmail(email) : db.users.find((u) => u.email === email);
            if (!row || !verifyPassword(password, row.password_hash)) {
                return fail(res, 'Incorrect email or password.', 401);
            }
            if (mysqlStore.isConfigured()) {
                row = await mysqlStore.findUserByEmail(email);
            }
            row.role = normalizeRole(row.role);
            if (!mysqlStore.isConfigured()) {
                ensureWallet(db, row.id);
                saveDb(db);
            }
            setAuthCookie(res, row);
            return send(res, 200, { ok: true, user: publicUser(row), message: 'Logged in successfully.' });
        }

        if (method === 'POST' && p === '/auth/admin-login') {
            const email = String(input.email || '').trim().toLowerCase();
            const password = String(input.password || '');
            if (!email || !password) return fail(res, 'Enter your admin email and password.');
            const adminEmails = ['admin@raomitra.com', 'admin@roamitra.com'];
            let row;
            if (mysqlStore.isConfigured()) {
                row = adminEmails.includes(email)
                    ? (await mysqlStore.findUserByEmail('admin@raomitra.com')) || (await mysqlStore.findUserByEmail('admin@roamitra.com'))
                    : await mysqlStore.findUserByEmail(email);
            }
            if (!row) {
                row = adminEmails.includes(email)
                    ? db.users.find((u) => adminEmails.includes(u.email))
                    : db.users.find((u) => u.email === email);
            }
            if (!row || !verifyPassword(password, row.password_hash)) {
                return fail(res, 'Incorrect admin email or password.', 401);
            }
            if (!['admin', 'co_admin'].includes(normalizeRole(row.role))) {
                return fail(res, 'This account is still "' + normalizeRole(row.role) + '" in the website database. In Workbench set users.role to exactly admin, then log out and log in again.', 403);
            }
            if (!mysqlStore.isConfigured()) {
                ensureWallet(db, row.id);
                saveDb(db);
            }
            setAuthCookie(res, row);
            return send(res, 200, { ok: true, user: publicUser(row), message: 'Admin signed in.' });
        }

        if (method === 'POST' && p === '/auth/logout') {
            clearAuthCookie(res);
            return send(res, 200, { ok: true, message: 'Logged out' });
        }

        if (method === 'GET' && p === '/auth/me') {
            const user = await currentUser(req, db);
            if (!user) return fail(res, 'Not authenticated.', 401);
            return send(res, 200, { ok: true, user: publicUser(user) });
        }

        if (method === 'GET' && p === '/profile') {
            const user = await needUser();
            const wallet = ensureWallet(db, user.id);
            return send(res, 200, {
                ok: true,
                user: publicUser(user),
                wallet,
                transactions: db.wallet_transactions.filter((t) => t.wallet_id === wallet.id).slice().reverse().slice(0, 30),
                trips: db.trips.filter((t) => t.user_id === user.id).sort((a, b) => String(b.start_date).localeCompare(String(a.start_date))),
                bookings: db.vehicle_bookings.filter((b) => b.user_id === user.id).slice().reverse(),
                host_application: db.host_applications.filter((a) => a.user_id === user.id).sort((a, b) => b.id - a.id)[0] || null,
            });
        }

        if (method === 'POST' && p === '/profile') {
            const user = await needUser();
            const name = String(input.full_name || '').replace(/\s+/g, ' ').trim();
            if (!/^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u.test(name)) {
                return fail(res, 'Full name can contain letters only (spaces, hyphens, and apostrophes are allowed).');
            }
            const bio = String(input.bio || '').trim();
            const location = String(input.location || '').trim();
            if (bio.length > 400) return fail(res, 'Keep your bio under 400 characters.');
            if (location.length > 120) return fail(res, 'Keep your location under 120 characters.');
            const presets = {
                forest: 'linear-gradient(135deg,#0B3D2E 0%,#1A8A58 45%,#76D885 100%)',
                ocean: 'linear-gradient(135deg,#051635 0%,#0A4A6E 50%,#47A8A3 100%)',
                sunset: 'linear-gradient(135deg,#7C2D12 0%,#EA580C 45%,#FBBF24 100%)',
                dusk: 'linear-gradient(135deg,#1E1B4B 0%,#6D28D9 55%,#F472B6 100%)',
                night: 'linear-gradient(135deg,#020617 0%,#0F172A 50%,#334155 100%)',
            };
            const nextMedia = (value, current, maxLen, allowPreset) => {
                if (value === undefined || value === null) return current || null;
                const raw = String(value).trim();
                if (raw === '' || raw === 'remove') return null;
                if (raw.startsWith('preset:') && allowPreset) {
                    const id = raw.slice(7);
                    if (!presets[id]) throw Object.assign(new Error('Choose a valid cover style.'), { status: 400 });
                    return presets[id];
                }
                if (/^https?:\/\//i.test(raw) && raw.length <= 500) return raw;
                if (raw.startsWith('linear-gradient(') && allowPreset) return raw;
                if (/^uploads\/profiles\/[a-z0-9._-]+$/i.test(raw)) return raw;
                if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(raw.slice(0, 80))) {
                    throw Object.assign(new Error('Use a JPEG, PNG, or WebP image.'), { status: 400 });
                }
                if (raw.length > maxLen) {
                    throw Object.assign(new Error('That photo is too large. Try a smaller image.'), { status: 400 });
                }
                return raw;
            };
            let avatar;
            let cover;
            try {
                avatar = nextMedia(input.avatar_url, user.avatar_url, 900000, false);
                cover = nextMedia(input.cover_url, user.cover_url, 1200000, true);
            } catch (err) {
                return fail(res, err.message, err.status || 400);
            }
            user.full_name = name;
            user.bio = bio || null;
            user.location = location || null;
            user.avatar_url = avatar;
            user.cover_url = cover;
            if (mysqlStore.isConfigured()) {
                await mysqlStore.updateUserProfile(user.id, {
                    full_name: name,
                    bio: bio || null,
                    location: location || null,
                    avatar_url: avatar,
                    cover_url: cover,
                });
            }
            saveDb(db);
            return send(res, 200, { ok: true, user: publicUser(user), message: 'Profile saved.' });
        }

        if (method === 'GET' && p === '/trips') {
            const user = await needUser();
            const trips = db.trips.filter((t) => t.user_id === user.id).map((t) => {
                const cur = db.itineraries.find((i) => i.trip_id === t.id && i.is_current);
                return Object.assign({}, t, { current_itinerary_id: cur ? cur.id : null });
            });
            return send(res, 200, { ok: true, trips });
        }

        if (method === 'POST' && p === '/trips') {
            const user = await needUser();
            const trip = parseTripInput(input);
            const row = addRow(db, 'trips', Object.assign({}, trip, {
                user_id: user.id,
                status: 'draft',
                is_saved: 0,
                created_at: nowIso(),
                updated_at: nowIso(),
            }));
            saveDb(db);
            return send(res, 201, { ok: true, trip: row });
        }

        const tripShow = p.match(/^\/trips\/(\d+)$/);
        if (method === 'GET' && tripShow) {
            const user = await needUser();
            const trip = ownedTrip(db, Number(tripShow[1]), user.id);
            const itinerary = currentItinerary(db, trip.id);
            return send(res, 200, {
                ok: true,
                trip,
                itinerary,
                versions: db.itineraries.filter((i) => i.trip_id === trip.id).sort((a, b) => b.version - a.version),
                messages: db.itinerary_messages.filter((m) => m.trip_id === trip.id),
            });
        }

        const tripGen = p.match(/^\/trips\/(\d+)\/generate$/);
        if (method === 'POST' && tripGen) {
            const user = await needUser();
            const trip = ownedTrip(db, Number(tripGen[1]), user.id);
            const data = generateItinerary(trip);
            db.itineraries.forEach((i) => {
                if (i.trip_id === trip.id) i.is_current = 0;
            });
            const version = db.itineraries.filter((i) => i.trip_id === trip.id).reduce((m, i) => Math.max(m, i.version || 0), 0) + 1;
            const row = addRow(db, 'itineraries', {
                trip_id: trip.id,
                version,
                is_current: 1,
                itinerary_json: data,
                summary: data.summary,
                created_at: nowIso(),
            });
            trip.status = 'generated';
            trip.updated_at = nowIso();
            notify(db, user.id, 'itinerary', 'Itinerary generated', 'Your ' + trip.destination + ' itinerary is ready.', 'itinerary.html?trip=' + trip.id);
            saveDb(db);
            return send(res, 200, { ok: true, trip, itinerary: Object.assign({}, data, { id: row.id, version }) });
        }

        const tripSave = p.match(/^\/trips\/(\d+)\/save$/);
        if (method === 'POST' && tripSave) {
            const user = await needUser();
            const trip = ownedTrip(db, Number(tripSave[1]), user.id);
            trip.is_saved = 1;
            trip.status = 'saved';
            trip.updated_at = nowIso();
            notify(db, user.id, 'saved_trip', 'Trip saved', 'Saved your ' + trip.destination + ' trip.', 'itinerary.html?trip=' + trip.id);
            saveDb(db);
            return send(res, 200, { ok: true, trip });
        }

        const tripAsst = p.match(/^\/trips\/(\d+)\/assistant$/);
        if (method === 'POST' && tripAsst) {
            const user = await needUser();
            const trip = ownedTrip(db, Number(tripAsst[1]), user.id);
            const message = String(input.message || '').trim();
            if (!message) return fail(res, 'Enter a message for the travel assistant.');
            const current = currentItinerary(db, trip.id);
            if (!current) return fail(res, 'Generate an itinerary first.', 409);
            const data = Object.assign({}, current, { summary: (current.summary || '') + ' Updated: ' + message });
            db.itineraries.forEach((i) => {
                if (i.trip_id === trip.id) i.is_current = 0;
            });
            const version = db.itineraries.filter((i) => i.trip_id === trip.id).reduce((m, i) => Math.max(m, i.version || 0), 0) + 1;
            const row = addRow(db, 'itineraries', {
                trip_id: trip.id,
                version,
                is_current: 1,
                itinerary_json: data,
                summary: data.summary,
                created_at: nowIso(),
            });
            const reply = 'Updated your ' + trip.destination + ' plan for: ' + message;
            addRow(db, 'itinerary_messages', { trip_id: trip.id, itinerary_id: row.id, role: 'user', message, created_at: nowIso() });
            addRow(db, 'itinerary_messages', { trip_id: trip.id, itinerary_id: row.id, role: 'assistant', message: reply, created_at: nowIso() });
            saveDb(db);
            return send(res, 200, {
                ok: true,
                reply,
                itinerary: Object.assign({}, data, { id: row.id, version }),
                messages: db.itinerary_messages.filter((m) => m.trip_id === trip.id),
            });
        }

        if (method === 'GET' && p === '/notifications') {
            const user = await needUser();
            const today = new Date().toISOString().slice(0, 10);
            const notes = db.notifications.filter((n) => n.user_id === user.id).sort((a, b) => b.id - a.id).slice(0, 40);
            return send(res, 200, {
                ok: true,
                notifications: notes,
                unread: notes.filter((n) => !n.is_read).length,
                upcoming_trips: db.trips.filter((t) => t.user_id === user.id && t.end_date >= today).slice(0, 8),
                saved_trips: db.trips.filter((t) => t.user_id === user.id && t.is_saved).slice(0, 8),
                recent_itineraries: db.trips.filter((t) => t.user_id === user.id && (t.status === 'generated' || t.status === 'saved')).slice(0, 8),
            });
        }

        const noteRead = p.match(/^\/notifications\/(\d+)\/read$/);
        if (method === 'POST' && noteRead) {
            const user = await needUser();
            const note = db.notifications.find((n) => n.id === Number(noteRead[1]) && n.user_id === user.id);
            if (note) note.is_read = 1;
            saveDb(db);
            return send(res, 200, { ok: true, unread: db.notifications.filter((n) => n.user_id === user.id && !n.is_read).length });
        }

        if (method === 'POST' && p === '/notifications/read-all') {
            const user = await needUser();
            db.notifications.forEach((n) => {
                if (n.user_id === user.id) n.is_read = 1;
            });
            saveDb(db);
            return send(res, 200, { ok: true, unread: 0 });
        }

        if (method === 'GET' && p === '/wallet') {
            const user = await needUser();
            const wallet = ensureWallet(db, user.id);
            return send(res, 200, {
                ok: true,
                wallet,
                transactions: db.wallet_transactions.filter((t) => t.wallet_id === wallet.id).slice().reverse(),
            });
        }

        if (method === 'POST' && p === '/roamini/chat') {
            const message = String(input.message || input.text || '').trim();
            if (!message) return fail(res, 'Type a question for Roamini.');
            const reply = await roaminiChat(message, input.history || []);
            return send(res, 200, { ok: true, reply });
        }

        if (method === 'POST' && p === '/translate') {
            const text = String(input.text || '').trim();
            let source = String(input.source_lang || 'en');
            let target = String(input.target_lang || 'hi');
            let mode = String(input.mode || 'text');
            if (!text) return fail(res, 'Enter a phrase to translate.');
            if (!['text', 'voice'].includes(mode)) mode = 'text';
            const translated = await translateText(text, source, target);
            const user = await currentUser(req, db);
            if (user) {
                addRow(db, 'translator_history', {
                    user_id: user.id,
                    source_lang: source,
                    target_lang: target,
                    source_text: text,
                    translated_text: translated,
                    mode,
                    created_at: nowIso(),
                });
                const prefs = db.translator_prefs.find((r) => r.user_id === user.id);
                if (prefs) {
                    prefs.source_lang = source;
                    prefs.target_lang = target;
                } else {
                    db.translator_prefs.push({ user_id: user.id, source_lang: source, target_lang: target });
                }
                saveDb(db);
            }
            return send(res, 200, { ok: true, source_lang: source, target_lang: target, source_text: text, translated_text: translated, mode });
        }

        if (method === 'GET' && p === '/translate/history') {
            const user = await needUser();
            const prefs = db.translator_prefs.find((r) => r.user_id === user.id) || { source_lang: 'en', target_lang: 'hi' };
            return send(res, 200, {
                ok: true,
                history: db.translator_history.filter((h) => h.user_id === user.id).slice().reverse().slice(0, 20),
                prefs,
            });
        }

        if (method === 'GET' && p === '/community/posts') {
            if (mysqlStore.isConfigured()) {
                const posts = await mysqlStore.listPosts();
                return send(res, 200, { ok: true, posts: posts || [] });
            }
            const posts = db.community_posts.slice().reverse().slice(0, 30).map((post) => {
                const author = db.users.find((u) => u.id === post.user_id);
                return Object.assign({}, post, {
                    full_name: author ? author.full_name : 'Traveler',
                    reply_count: db.community_replies.filter((r) => r.post_id === post.id).length,
                });
            });
            return send(res, 200, { ok: true, posts });
        }

        if (method === 'POST' && p === '/community/posts') {
            const user = await needUser();
            const title = String(input.title || '').trim();
            const body = String(input.body || '').trim();
            if (!title || !body) return fail(res, 'Add a title and question.');
            if (mysqlStore.isConfigured()) {
                const postId = await mysqlStore.createPost(user.id, title, body);
                return send(res, 201, { ok: true, post_id: postId });
            }
            const post = addRow(db, 'community_posts', { user_id: user.id, title, body, created_at: nowIso() });
            notify(db, user.id, 'community', 'Question posted', 'You posted: ' + title, 'community.html');
            saveDb(db);
            return send(res, 201, { ok: true, post_id: post.id });
        }

        const replyMatch = p.match(/^\/community\/posts\/(\d+)\/replies$/);
        if (method === 'POST' && replyMatch) {
            const user = await needUser();
            const body = String(input.body || '').trim();
            if (!body) return fail(res, 'Reply cannot be empty.');
            if (mysqlStore.isConfigured()) {
                await mysqlStore.addReply(Number(replyMatch[1]), user.id, body);
                return send(res, 200, { ok: true });
            }
            const post = db.community_posts.find((r) => r.id === Number(replyMatch[1]));
            if (!post) return fail(res, 'Post not found.', 404);
            addRow(db, 'community_replies', { post_id: post.id, user_id: user.id, body, created_at: nowIso() });
            if (post.user_id !== user.id) {
                notify(db, post.user_id, 'community', 'New reply on your question', user.full_name + ' replied to “' + post.title + '”.', 'community.html');
            }
            saveDb(db);
            return send(res, 200, { ok: true });
        }

        if (method === 'POST' && p === '/bookings') {
            const user = await needUser();
            const name = String(input.vehicle_name || '').trim();
            const start = String(input.start_date || '');
            const end = String(input.end_date || '');
            if (!name || name.length > 180) return fail(res, 'Choose a vehicle to book.');
            if (!start || !end) return fail(res, 'Pick valid pickup and return dates.');
            if (end < start) return fail(res, 'Return date must be on or after the pickup date.');
            const days = daysBetween(start, end);
            const rate = Math.max(0, Number(input.daily_rate || 0));
            const total = Math.round(rate * days * 100) / 100;
            const booking = addRow(db, 'vehicle_bookings', {
                user_id: user.id,
                vehicle_name: name,
                category: String(input.category || '').trim() || null,
                location: String(input.location || '').trim() || null,
                daily_rate: rate,
                start_date: start,
                end_date: end,
                days,
                total,
                notes: String(input.notes || '').trim() || null,
                status: 'confirmed',
                created_at: nowIso(),
            });
            notify(db, user.id, 'booking', 'Booking confirmed', name + ' is reserved for ' + days + ' day(s). Total $' + total.toFixed(2) + '.', 'profile.html');
            notifyStaff(db, 'booking', 'New vehicle booking', user.full_name + ' booked ' + name + '.', 'admin.html');
            saveDb(db);
            return send(res, 200, { ok: true, booking, message: 'Your booking is confirmed.' });
        }

        if (method === 'GET' && p === '/bookings') {
            const user = await needUser();
            return send(res, 200, { ok: true, bookings: db.vehicle_bookings.filter((b) => b.user_id === user.id).slice().reverse() });
        }

        if (method === 'POST' && p === '/host/apply') {
            const user = await needUser();
            if (['host', 'admin', 'co_admin'].includes(user.role)) {
                return fail(res, 'Your account is already a host or staff account.');
            }
            let type = String(input.listing_type || 'host');
            if (!['host', 'vehicle'].includes(type)) type = 'host';
            const city = String(input.city || '').trim();
            const country = String(input.country || 'India').trim() || 'India';
            const phone = String(input.phone || '').trim();
            const bio = String(input.bio || '').trim();
            const experience = String(input.experience || '').trim();
            const vehicleInfo = String(input.vehicle_info || '').trim();
            if (!city || city.length > 120) return fail(res, 'Enter the city you host or list from.');
            if (!phone || phone.length > 40) return fail(res, 'Enter a contact phone number.');
            if (bio.length < 20) return fail(res, 'Tell travelers a bit more about yourself (at least 20 characters).');
            if (type === 'vehicle' && !vehicleInfo) return fail(res, 'Describe the vehicle you want to list.');
            if (db.host_applications.some((a) => a.user_id === user.id && a.status === 'pending')) {
                return fail(res, 'You already have a host application waiting for review.');
            }
            const application = addRow(db, 'host_applications', {
                user_id: user.id,
                listing_type: type,
                city,
                country,
                phone,
                bio,
                experience: experience || null,
                vehicle_info: vehicleInfo || null,
                status: 'pending',
                review_note: null,
                reviewed_by: null,
                created_at: nowIso(),
                updated_at: nowIso(),
            });
            notify(db, user.id, 'host', 'Host request sent to admin', 'Your Become a Host request is now in the admin dashboard for review.', 'host.html');
            notifyStaff(db, 'host', 'New host request', user.full_name + ' asked to become a ' + (type === 'vehicle' ? 'vehicle owner' : 'host') + ' in ' + city + '.', 'admin.html');
            saveDb(db);
            return send(res, 200, { ok: true, application, message: 'Your host request was sent to admin. You will be notified after review.' });
        }

        if (method === 'GET' && p === '/host/me') {
            const user = await needUser();
            const application = db.host_applications.filter((a) => a.user_id === user.id).sort((a, b) => b.id - a.id)[0] || null;
            return send(res, 200, { ok: true, application, user: publicUser(user) });
        }

        if (method === 'GET' && p === '/admin/overview') {
            const user = await needUser();
            if (!['admin', 'co_admin'].includes(user.role)) return fail(res, 'You do not have access to this page.', 403);
            const apps = db.host_applications.slice().reverse().map((a) => {
                const u = db.users.find((x) => x.id === a.user_id) || {};
                return Object.assign({}, a, { full_name: u.full_name, email: u.email });
            });
            const bookings = db.vehicle_bookings.slice().reverse().slice(0, 80).map((b) => {
                const u = db.users.find((x) => x.id === b.user_id) || {};
                return Object.assign({}, b, { full_name: u.full_name, email: u.email });
            });
            let userCounts = { total: db.users.length, new_count: db.users.filter((u) => isNewUser(u.created_at, 7)).length };
            if (mysqlStore.isConfigured() && mysqlStore.listUsers) {
                const listed = await mysqlStore.listUsers({ filter: 'all', days: 7 });
                if (listed) userCounts = { total: listed.total, new_count: listed.new_count };
            }
            return send(res, 200, {
                ok: true,
                counts: {
                    pending_hosts: db.host_applications.filter((a) => a.status === 'pending').length,
                    bookings: bookings.length,
                    users: userCounts.total,
                    new_users: userCounts.new_count,
                },
                applications: apps,
                bookings,
            });
        }

        if (method === 'GET' && p === '/admin/users') {
            const user = await needUser();
            if (!['admin', 'co_admin'].includes(user.role)) return fail(res, 'You do not have access to this page.', 403);
            const params = requestUrl(req).searchParams;
            const query = {
                filter: String(params.get('filter') || 'all').toLowerCase(),
                days: Number(params.get('days') || 7),
                q: String(params.get('q') || ''),
            };
            let listed = null;
            if (mysqlStore.isConfigured() && mysqlStore.listUsers) {
                listed = await mysqlStore.listUsers(query);
            }
            if (!listed) listed = listUsersFromStore(db, query);
            return send(res, 200, {
                ok: true,
                filter: listed.filter,
                days: listed.days,
                counts: { users: listed.total, new_users: listed.new_count },
                users: listed.users,
            });
        }

        if (method === 'POST' && p === '/admin/hosts/review') {
            const staff = await needUser();
            if (!['admin', 'co_admin'].includes(staff.role)) return fail(res, 'You do not have access to this page.', 403);
            const id = Number(input.id || 0);
            const status = String(input.status || '');
            const note = String(input.note || '').trim();
            if (id < 1 || !['approved', 'rejected'].includes(status)) {
                return fail(res, 'Choose approve or reject for a valid application.');
            }
            const app = db.host_applications.find((a) => a.id === id);
            if (!app) return fail(res, 'Application not found.', 404);
            if (app.status !== 'pending') return fail(res, 'This application was already reviewed.');
            app.status = status;
            app.review_note = note || null;
            app.reviewed_by = staff.id;
            app.updated_at = nowIso();
            if (status === 'approved') {
                const member = db.users.find((u) => u.id === app.user_id);
                if (member && member.role === 'customer') member.role = 'host';
                notify(db, app.user_id, 'host', 'You are now a verified host', note || 'Your host application was approved. You can list stays or vehicles with Roamitra.', 'profile.html');
            } else {
                notify(db, app.user_id, 'host', 'Host application not approved', note || 'Your application was not approved. You can update details and apply again.', 'host.html');
            }
            saveDb(db);
            return send(res, 200, { ok: true, message: status === 'approved' ? 'Host approved.' : 'Application rejected.' });
        }

        if (method === 'POST' && p === '/admin/users/role') {
            const staff = await needUser();
            if (!['admin', 'co_admin'].includes(String(staff.role || '').toLowerCase())) {
                return fail(res, 'You do not have access to this page.', 403);
            }
            const userId = Number(input.user_id || input.id || 0);
            const role = String(input.role || '').toLowerCase().trim();
            if (userId < 1 || !['customer', 'host', 'co_admin', 'admin'].includes(role)) {
                return fail(res, 'Choose a valid user and role.');
            }
            const target = db.users.find((u) => Number(u.id) === userId);
            if (!target) return fail(res, 'User not found.', 404);
            const current = String(target.role || '').toLowerCase();
            if (['admin', 'co_admin'].includes(current) && !['admin', 'co_admin'].includes(role)) {
                const staffLeft = db.users.filter((u) => ['admin', 'co_admin'].includes(String(u.role || '').toLowerCase())).length;
                if (staffLeft < 2) return fail(res, 'Keep at least one admin account.');
            }
            target.role = role;
            if (mysqlStore.isConfigured() && mysqlStore.updateUserRole) {
                await mysqlStore.updateUserRole(userId, role);
            }
            saveDb(db);
            return send(res, 200, {
                ok: true,
                message: 'Role updated to ' + role + '. Ask that person to log out and log in again.',
                user_id: userId,
                role,
            });
        }

        return fail(res, 'Not found.', 404);
    } catch (err) {
        return fail(res, err.message || 'Server error', err.status || 500);
    }
}

module.exports = handle;
