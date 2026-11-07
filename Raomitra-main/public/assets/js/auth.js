/**
 * Roamitra — Auth Page Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(window.location.search).get('mode') === 'admin' && /login\.html$/i.test(window.location.pathname) && !/admin-login/i.test(window.location.pathname)) {
        window.location.replace((typeof RoamitraApi !== 'undefined' ? RoamitraApi.page('admin-login.html') : 'admin-login.html'));
        return;
    }
    initPasswordToggle();
    initNameLettersOnly();
    initSignupValidation();
    initStaffLogoGate();
    initAuthSubmit();
    showRegisteredBanner();
});

function initStaffLogoGate() {
    const logo = document.getElementById('staffLogoGate');
    if (!logo) return;
    let clicks = 0;
    let timer = null;
    logo.addEventListener('click', (e) => {
        e.preventDefault();
        clicks += 1;
        clearTimeout(timer);
        if (clicks >= 5) {
            window.location.href = (typeof RoamitraApi !== 'undefined' ? RoamitraApi.page('admin-login.html') : 'admin-login.html');
            return;
        }
        timer = setTimeout(() => {
            clicks = 0;
            window.location.href = (typeof RoamitraApi !== 'undefined' ? RoamitraApi.page('explore.html') : 'explore.html');
        }, 600);
    });
}

function initPasswordToggle() {
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.closest('.auth-input-wrap').querySelector('input');
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('bi-eye', 'bi-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('bi-eye-slash', 'bi-eye');
            }
        });
    });
}

function lettersOnlyName(value) {
    return String(value)
        .replace(/[0-9]/g, '')
        .replace(/[^\p{L} '\-]/gu, '')
        .replace(/\s+/g, ' ');
}

function isValidFullName(value) {
    return /^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u.test(String(value).trim());
}

function initNameLettersOnly() {
    const nameInput = document.getElementById('full_name');
    if (!nameInput) return;
    nameInput.addEventListener('input', () => {
        const next = lettersOnlyName(nameInput.value);
        if (nameInput.value !== next) {
            nameInput.value = next;
        }
        nameInput.setCustomValidity(isValidFullName(nameInput.value.trim()) ? '' : 'Full name can contain letters only.');
    });
}

function initSignupValidation() {
    const form = document.getElementById('signupForm');
    if (!form) return;
    const confirm = form.querySelector('#confirm_password');
    if (confirm) {
        confirm.addEventListener('input', () => confirm.setCustomValidity(''));
    }
}

function initAuthSubmit() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const isAdmin = loginForm.dataset.role === 'admin';
            await submitAuth(
                loginForm,
                isAdmin ? '/auth/admin-login' : '/auth/login',
                isAdmin ? 'admin-login' : 'login'
            );
        });
    }
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitAuth(signupForm, '/auth/register', 'register');
        });
    }
}

function showRegisteredBanner() {
    const params = new URLSearchParams(window.location.search);
    const form = document.getElementById('loginForm');
    if (!form) return;
    if (params.get('registered') === '1') {
        const box = ensureStatusBox(form);
        box.className = 'auth-success';
        box.textContent = 'Signup successfully. Please log in to continue.';
        box.hidden = false;
    }
}

async function submitAuth(form, path, mode) {
    const btn = form.querySelector('[type="submit"]');
    const statusBox = ensureStatusBox(form);
    statusBox.hidden = true;
    statusBox.className = 'auth-error';

    if (mode === 'register') {
        const nameInput = form.querySelector('#full_name');
        const password = form.querySelector('#password');
        const confirm = form.querySelector('#confirm_password');
        if (nameInput) {
            nameInput.value = lettersOnlyName(nameInput.value).trim();
            if (!isValidFullName(nameInput.value)) {
                statusBox.textContent = 'Full name can contain letters only (no numbers).';
                statusBox.hidden = false;
                nameInput.focus();
                return;
            }
        }
        if (password && confirm && password.value !== confirm.value) {
            confirm.setCustomValidity('Passwords do not match');
            confirm.reportValidity();
            return;
        }
    }

    btn.disabled = true;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.remember = !!(form.querySelector('[name="remember"]')?.checked);
    try {
        const data = await RoamitraApi.post(path, payload);
        statusBox.className = 'auth-success';
        statusBox.hidden = false;
        if (mode === 'register') {
            statusBox.textContent = data.message || 'Signup successfully. Please log in to continue.';
            btn.innerHTML = 'Redirecting to login…';
            setTimeout(() => {
                const next = new URLSearchParams(window.location.search).get('next');
                const login = RoamitraApi.page('login.html') + '?registered=1' + (next ? '&next=' + encodeURIComponent(next) : '');
                window.location.href = login;
            }, 1400);
            return;
        }
        statusBox.textContent = data.message || 'Logged in successfully.';
        btn.innerHTML = 'Signing you in…';
        const role = String(data.user?.role || '').toLowerCase();
        const isStaff = role === 'admin' || role === 'co_admin';
        setTimeout(() => {
            if (mode === 'admin-login' || (isStaff && !new URLSearchParams(window.location.search).get('next'))) {
                window.location.href = RoamitraApi.page('admin.html');
                return;
            }
            window.location.href = nextPage();
        }, 700);
    } catch (err) {
        statusBox.className = 'auth-error';
        statusBox.textContent = err.message || 'Something went wrong.';
        statusBox.hidden = false;
        btn.disabled = false;
    }
}

function nextPage() {
    const raw = new URLSearchParams(window.location.search).get('next');
    const fallback = RoamitraApi.page('explore.html');
    if (!raw) return fallback;
    try {
        const url = new URL(raw, window.location.origin);
        if (url.origin !== window.location.origin) return fallback;
        const file = url.pathname.split('/').pop() || '';
        if (!file.endsWith('.html')) return fallback;
        const hash = /^#[A-Za-z0-9_-]+$/.test(url.hash) ? url.hash : '';
        return RoamitraApi.page(file) + url.search + hash;
    } catch (e) {
        return fallback;
    }
}

function ensureStatusBox(form) {
    let box = form.querySelector('.auth-error, .auth-success');
    if (!box) {
        box = document.createElement('div');
        box.className = 'auth-error';
        box.setAttribute('role', 'alert');
        form.prepend(box);
    }
    return box;
}
