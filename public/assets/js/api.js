/**
 * Roamitra API client — talks to public/api/index.php (XAMPP) or /api/index.php (Vercel).
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
        return '/';
    },

    page(name) {
        const prefix = this.basePath();
        return prefix === '/' ? `/${name}` : prefix + name;
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
                    ? 'Login API did not return JSON. On Vercel, PHP must run as a function and a remote MySQL database must be set in project environment variables.'
                    : 'Invalid server response.'
            };
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
