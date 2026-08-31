/**
 * Roamitra API client — talks to public/api/index.php
 */
const RoamitraApi = {
    base: 'api/index.php',

    url(path) {
        const prefix = this.basePath();
        return `${prefix}${this.base}?r=${encodeURIComponent(path)}`;
    },

    basePath() {
        const path = window.location.pathname.replace(/\\/g, '/');
        if (path.includes('/public/')) {
            return path.slice(0, path.indexOf('/public/') + '/public/'.length);
        }
        return './';
    },

    page(name) {
        return this.basePath() + name;
    },

    async request(path, options = {}) {
        const headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }
        const res = await fetch(this.url(path), Object.assign({ credentials: 'include' }, options, { headers }));
        let data = {};
        try {
            data = await res.json();
        } catch (e) {
            data = { ok: false, error: 'Invalid server response.' };
        }
        if (!res.ok || data.ok === false) {
            const err = new Error(data.error || 'Request failed.');
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    },

    get(path) {
        return this.request(path, { method: 'GET' });
    },

    post(path, body) {
        return this.request(path, { method: 'POST', body });
    },

    async me() {
        try {
            const data = await this.get('/auth/me');
            return data.user || null;
        } catch (e) {
            return null;
        }
    }
};

window.RoamitraApi = RoamitraApi;
