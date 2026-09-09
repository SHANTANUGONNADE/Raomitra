/**
 * Roamitra API client.
 * XAMPP: public/api/index.php
 * Vercel: /api  (Node serverless — POST to a static .php file returns 405)
 */
const RoamitraApi = {
    endpoint() {
        const path = window.location.pathname.replace(/\\/g, '/');
        if (path.includes('/public/')) {
            return path.slice(0, path.indexOf('/public/') + '/public/'.length) + 'api/index.php';
        }
        return '/api';
    },

    url(path) {
        return `${this.endpoint()}?r=${encodeURIComponent(path)}`;
    },

    basePath() {
        const path = window.location.pathname.replace(/\\/g, '/');
        if (path.includes('/public/')) {
            return path.slice(0, path.indexOf('/public/') + '/public/'.length);
        }
        return '/';
    },

    page(name) {
        const prefix = this.basePath();
        return prefix === '/' ? `/${name}` : prefix + name;
    },

    mediaUrl(value) {
        if (!value) return '';
        const raw = String(value);
        if (/^(data:|blob:|https?:|linear-gradient\()/i.test(raw)) return raw;
        return this.basePath() + raw.replace(/^\//, '');
    },

    errorMessage(data, res, text) {
        if (data && typeof data.error === 'string' && data.error) return data.error;
        if (data && typeof data.message === 'string' && data.message) return data.message;
        if (data && data.error && typeof data.error === 'object') {
            return data.error.message || JSON.stringify(data.error);
        }
        if (res && res.status === 405) {
            return 'The live API is not running yet. Redeploy from the repo root and wait until the build finishes.';
        }
        if (text && text.length && text.length < 240 && !/^\s*</.test(text)) return text;
        return res && res.status ? `Request failed (${res.status}).` : 'Request failed.';
    },

    async request(path, options = {}) {
        const headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }
        const res = await fetch(this.url(path), Object.assign({ credentials: 'include' }, options, { headers }));
        const text = await res.text();
        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            const html = /^\s*</.test(text) || (res.headers.get('content-type') || '').includes('text/html');
            data = {
                ok: false,
                error: html
                    ? 'The login API did not run. Redeploy from the project root (not the public folder) so PHP can start.'
                    : 'Invalid server response.'
            };
        }
        if (!res.ok || data.ok === false) {
            const err = new Error(this.errorMessage(data, res, text));
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
