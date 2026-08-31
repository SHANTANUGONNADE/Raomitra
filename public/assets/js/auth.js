/**
 * Roamitra — Auth Page Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
    initPasswordToggle();
    initNameLettersOnly();
    initSignupValidation();
    initLoginRoleToggle();
    initAuthSubmit();
    showRegisteredBanner();
});

function initLoginRoleToggle() {
    const form = document.getElementById('loginForm');
    const buttons = document.querySelectorAll('.auth-role-toggle [data-role]');
    if (!form || !buttons.length) return;

    const applyRole = (role) => {
        form.dataset.role = role;
        buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.role === role));
        const subtitle = document.getElementById('loginSubtitle');
        const emailLabel = document.getElementById('emailLabel');
        const email = document.getElementById('email');
        const submit = document.getElementById('loginSubmit');
        if (role === 'admin') {
            if (subtitle) subtitle.textContent = 'Sign in with an admin or co-admin account';
            if (emailLabel) emailLabel.textContent = 'Admin email';
            if (email) email.placeholder = 'admin@raomitra.com';
            if (submit) submit.innerHTML = 'Sign in as admin <i class="bi bi-arrow-right"></i>';
        } else {
            if (subtitle) subtitle.textContent = 'Sign in to continue your journey';
            if (emailLabel) emailLabel.textContent = 'Email';
            if (email) email.placeholder = 'you@example.com';
            if (submit) submit.innerHTML = 'Sign In <i class="bi bi-arrow-right"></i>';
        }
    };

    buttons.forEach(btn => {
        btn.addEventListener('click', () => applyRole(btn.dataset.role));
    });

    const params = new URLSearchParams(window.location.search);
    applyRole(params.get('mode') === 'admin' ? 'admin' : 'member');
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
        setTimeout(() => {
            window.location.href = mode === 'admin-login'
                ? RoamitraApi.page('admin.html')
                : nextPage();
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
    const fallback = RoamitraApi.page('planner.html');
    if (!raw) return fallback;
    try {
        const url = new URL(raw, window.location.origin);
        if (url.origin !== window.location.origin) return fallback;
        const file = url.pathname.split('/').pop() || '';
        if (!file.endsWith('.html')) return fallback;
        return RoamitraApi.page(file) + url.search;
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
