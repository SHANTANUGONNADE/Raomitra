/**
 * Roamini — fullscreen travel assistant
 */

function roamitraSpeechLang(code) {
    const map = { en: 'en-US', hi: 'hi-IN', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', ja: 'ja-JP', ta: 'ta-IN', kn: 'kn-IN', te: 'te-IN', bn: 'bn-IN', ar: 'ar-SA' };
    if (code === 'zh-CN' || code === 'zh') return 'zh-CN';
    return map[code] || code || 'en-US';
}

function roamitraLoadVoices() {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) {
            resolve([]);
            return;
        }
        const existing = window.speechSynthesis.getVoices();
        if (existing.length) {
            resolve(existing);
            return;
        }
        const finish = () => resolve(window.speechSynthesis.getVoices());
        window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
        window.speechSynthesis.getVoices();
        setTimeout(finish, 700);
    });
}

const WHISPER_LANG = {
    en: 'english', hi: 'hindi', es: 'spanish', fr: 'french', de: 'german', it: 'italian',
    pt: 'portuguese', ja: 'japanese', ko: 'korean', ar: 'arabic', ru: 'russian', ta: 'tamil',
    te: 'telugu', kn: 'kannada', ml: 'malayalam', bn: 'bengali', mr: 'marathi', gu: 'gujarati',
    th: 'thai', vi: 'vietnamese', tr: 'turkish', nl: 'dutch', 'zh-CN': 'chinese', zh: 'chinese'
};

let whisperPipe = null;
let whisperLoading = null;

let whisperStatus = null;

function loadWhisper(onStatus) {
    if (onStatus) whisperStatus = onStatus;
    if (whisperPipe) return Promise.resolve(whisperPipe);
    if (!whisperLoading) {
        whisperLoading = (async () => {
            if (whisperStatus) whisperStatus('Preparing voice… the first time can take a moment.');
            const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
            transformers.env.allowLocalModels = false;
            transformers.env.useBrowserCache = true;
            if (transformers.env.backends?.onnx?.wasm) {
                transformers.env.backends.onnx.wasm.numThreads = 1;
            }
            whisperPipe = await transformers.pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
                progress_callback: (data) => {
                    if (!whisperStatus || !data || data.status !== 'progress' || !data.total) return;
                    const pct = Math.min(100, Math.round((data.loaded / data.total) * 100));
                    if (pct >= 100) return;
                    whisperStatus('Preparing voice… ' + pct + '%');
                }
            });
            return whisperPipe;
        })().catch((err) => {
            whisperLoading = null;
            throw err;
        });
    }
    return whisperLoading;
}

async function audioBlobTo16k(blob) {
    const ctx = new AudioContext();
    try {
        await ctx.resume();
        const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
        const length = Math.max(1, Math.ceil(decoded.duration * 16000));
        const offline = new OfflineAudioContext(1, length, 16000);
        const source = offline.createBufferSource();
        source.buffer = decoded;
        source.connect(offline.destination);
        source.start(0);
        const rendered = await offline.startRendering();
        return new Float32Array(rendered.getChannelData(0));
    } finally {
        ctx.close();
    }
}

window.RoamitraVoice = {
    listen({ lang, onStatus, onText, onError }) {
        let finished = false;
        let recorder = null;
        let stream = null;
        const chunks = [];
        const report = (msg) => onStatus(msg);
        const fail = (msg) => {
            if (whisperStatus === report) whisperStatus = null;
            onError(msg);
        };
        const succeed = (text) => {
            if (whisperStatus === report) whisperStatus = null;
            onText(text);
        };
        const stopTracks = () => {
            if (stream) stream.getTracks().forEach((track) => track.stop());
        };
        const finish = () => {
            if (finished) return;
            finished = true;
            if (recorder && recorder.state !== 'inactive') recorder.stop();
            else stopTracks();
        };
        (async () => {
            try {
                if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
                    fail('Voice input needs Chrome or Edge.');
                    return;
                }
                report('Allow the microphone, then speak.');
                loadWhisper(report).catch(() => {});
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (finished) {
                    stopTracks();
                    return;
                }
                report('Listening… speak, then tap Stop.');
                const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
                const mime = types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
                recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
                recorder.ondataavailable = (event) => {
                    if (event.data && event.data.size) chunks.push(event.data);
                };
                recorder.onstop = async () => {
                    stopTracks();
                    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
                    if (blob.size < 800) {
                        fail('No speech was detected. Try again.');
                        return;
                    }
                    try {
                        const pipe = await loadWhisper(report);
                        report('Transcribing…');
                        const audio = await audioBlobTo16k(blob);
                        const language = WHISPER_LANG[lang] || WHISPER_LANG[String(lang || '').slice(0, 2)];
                        const options = { task: 'transcribe' };
                        if (language) options.language = language;
                        const output = await pipe(audio, options);
                        const text = String((output && output.text) || '').replace(/\s+/g, ' ').trim();
                        if (!text || /^\s*(\([^)]*\)|\[[^\]]*\])\s*$/.test(text) || /blank_audio/i.test(text)) {
                            fail('Could not hear that clearly. Try again.');
                            return;
                        }
                        succeed(text);
                    } catch (err) {
                        const detail = err && err.message ? String(err.message).replace(/\s+/g, ' ').trim().slice(0, 140) : '';
                        fail(detail
                            ? 'Voice could not finish. ' + detail
                            : 'Could not transcribe that. Stay online for the first voice setup, then try again.');
                    }
                };
                recorder.start(250);
                setTimeout(finish, 9000);
            } catch (err) {
                finished = true;
                stopTracks();
                if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                    fail('Microphone permission was denied.');
                } else {
                    fail('Could not start the microphone.');
                }
            }
        })();
        return finish;
    }
};

async function roamitraTranslateDirect(text, source, target) {
    const sl = source === 'auto' || source === 'autodetect' ? 'auto' : source;
    const url = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl='
        + encodeURIComponent(sl) + '&tl=' + encodeURIComponent(target)
        + '&q=' + encodeURIComponent(String(text || '').slice(0, 450));
    const res = await fetch(url);
    if (!res.ok) throw new Error('Translation service is unavailable.');
    const data = await res.json();
    const out = Array.isArray(data) ? data.filter((part) => typeof part === 'string').join('').trim() : '';
    if (!out) throw new Error('Translation service is unavailable.');
    return out;
}

async function roamitraSpeak(text, lang) {
    if (!text || !window.speechSynthesis) return;
    const voices = await roamitraLoadVoices();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = roamitraSpeechLang(lang);
    const prefix = u.lang.toLowerCase().slice(0, 2);
    const match = voices.find((v) => v.lang.toLowerCase() === u.lang.toLowerCase())
        || voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (match) u.voice = match;
    u.rate = 0.95;
    window.speechSynthesis.resume();
    setTimeout(() => window.speechSynthesis.speak(u), 60);
}

const RoamitraAI = {
    isOpen: false,
    isTyping: false,
    conversationHistory: [],
    bound: false,
    welcomeKey: 'roamini-welcome-day',

    faqResponses: {
        'travel packages': 'We offer curated travel packages to 88+ countries including adventure tours, cultural experiences, beach getaways, and city explorations. Browse Explore to find packages that match your interests and budget!',
        'become a host': 'To become a host, log in and open Ask to Host. Submit your city, phone, and a short bio. Admin approval makes you a verified host.',
        'cancellation policy': 'Most bookings can be cancelled up to 48 hours before for a full refund. Vehicle rentals and meetups may have different terms.',
        'booking process': 'Open Ask to Rent, choose a vehicle, and click Book Now. Pick pickup and return dates, then confirm. You must be logged in.',
        'destinations': 'Popular spots include Bali, Tokyo, Paris, Yosemite, and Bangalore. Use the Explore page for featured destinations and local tips.',
        'host registration': 'Host registration needs a verified account, the application form, and identity details. Review typically takes 3–5 business days.',
        'faq': 'How do I book? Create an account, search, and book. How do I become a host? Apply via Ask to Host. Need more help? Ask me anything!',
        'default': 'Thanks for your question! I can help with destinations, Ask to Rent, Ask to Host, meetups, and trip planning. Tell me a bit more.'
    },

    langs: [
        ['en', 'English'], ['hi', 'Hindi'], ['es', 'Spanish'], ['fr', 'French'],
        ['de', 'German'], ['ja', 'Japanese'], ['ta', 'Tamil'], ['kn', 'Kannada'],
        ['te', 'Telugu'], ['bn', 'Bengali'], ['ar', 'Arabic'], ['zh-CN', 'Chinese']
    ],

    mount() {
        this.ensureWidget();
        this.init();
    },

    ensureWidget() {
        const complete = document.getElementById('aiFab')
            && document.getElementById('aiPopup')
            && document.getElementById('aiSuggestions')
            && document.getElementById('aiMessages')
            && document.getElementById('aiInput')
            && document.getElementById('aiSend')
            && document.getElementById('aiClose')
            && document.getElementById('romiLangPop')
            && document.getElementById('romiLangActions');
        if (complete) {
            this.renameLabels();
            return;
        }
        document.getElementById('aiFab')?.remove();
        document.getElementById('aiPopup')?.remove();
        document.getElementById('romiLangPop')?.remove();
        document.getElementById('roaminiDrawer')?.remove();
        document.getElementById('roaminiBackdrop')?.remove();
        const src = (typeof RoamitraApi !== 'undefined' ? RoamitraApi.basePath() : '') + 'assets/images/ai-bot.jpeg';
        const langOpts = this.langs.map(([code, label]) => `<option value="${code}">${label}</option>`).join('');
        document.body.insertAdjacentHTML('beforeend', `
            <button class="ai-assistant-fab" id="aiFab" aria-label="Open Roamini">
                <img src="${src}" alt="" class="ai-bot-photo">
            </button>
            <div class="romi-lang-pop" id="romiLangPop" role="dialog" aria-label="Translate">
                <div class="romi-lang-head">
                    <h5><i class="bi bi-translate"></i> Translate</h5>
                    <button type="button" class="romi-lang-close" id="romiLangClose" aria-label="Close translate"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="romi-lang-row">
                    <select id="romiSrcLang">${langOpts}</select>
                    <select id="romiTgtLang">${langOpts}</select>
                </div>
                <textarea id="romiSrcText" rows="3" placeholder="Type a phrase, or tap Speak"></textarea>
                <div class="romi-lang-actions" id="romiLangActions">
                    <button type="button" class="romi-speak" id="romiMicBtn" aria-label="Speak to translate" aria-pressed="false"><i class="bi bi-mic"></i> <span>Speak</span></button>
                    <button type="button" class="btn-roamitra btn-roamitra-navy" id="romiTranslateBtn">Translate</button>
                </div>
                <p id="romiLangOut" class="romi-lang-out" hidden></p>
                <button type="button" class="romi-play" id="romiSpeakBtn" hidden><i class="bi bi-volume-up"></i> Play translation</button>
                <a class="romi-lang-more" href="${typeof RoamitraApi !== 'undefined' ? RoamitraApi.page('translator.html') : 'translator.html'}">Open full translator</a>
            </div>
            <div class="ai-assistant-popup" id="aiPopup" role="dialog" aria-modal="true" aria-label="Roamini">
                <div class="ai-assistant-header">
                    <div class="ai-assistant-header-info">
                        <div class="ai-assistant-avatar"><img src="${src}" alt="" class="ai-bot-photo"></div>
                        <div>
                            <h4>Roamini</h4>
                            <p>Your travel assistant</p>
                        </div>
                    </div>
                    <button class="ai-assistant-close" id="aiClose" type="button" aria-label="Close Roamini">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="ai-assistant-messages" id="aiMessages">
                    <div class="ai-message bot">
                        <div class="ai-message-avatar"><img src="${src}" alt="" class="ai-bot-photo"></div>
                        <div class="ai-message-bubble"><p>Hi! I'm Roamini. Ask me about destinations, Ask to Rent, Ask to Host, or planning a trip.</p></div>
                    </div>
                </div>
                <div class="ai-assistant-dock">
                <div class="ai-assistant-suggestions" id="aiSuggestions">
                    <button type="button" class="ai-suggestion-chip" data-question="What travel packages do you offer?">Travel Packages</button>
                    <button type="button" class="ai-suggestion-chip" data-question="How do I become a host?">Ask to Host</button>
                    <button type="button" class="ai-suggestion-chip" data-question="How does booking work?">Ask to Rent</button>
                    <button type="button" class="ai-suggestion-chip" data-question="What destinations do you recommend?">Destinations</button>
                </div>
                <div class="ai-assistant-input">
                    <input type="text" id="aiInput" placeholder="Ask Roamini anything about travel..." autocomplete="off">
                    <button type="button" id="aiSend" aria-label="Send message"><i class="bi bi-send-fill"></i></button>
                </div>
                </div>
            </div>
        `);
        const srcSel = document.getElementById('romiSrcLang');
        const tgtSel = document.getElementById('romiTgtLang');
        if (srcSel) srcSel.value = 'en';
        if (tgtSel) tgtSel.value = 'hi';
    },

    renameLabels() {
        document.querySelectorAll('.ai-assistant-header h4').forEach(el => { el.textContent = 'Roamini'; });
        document.getElementById('aiFab')?.setAttribute('aria-label', 'Open Roamini');
        document.getElementById('aiPopup')?.setAttribute('aria-label', 'Roamini');
    },

    init() {
        this.fab = document.getElementById('aiFab');
        this.popup = document.getElementById('aiPopup');
        this.closeBtn = document.getElementById('aiClose');
        this.messages = document.getElementById('aiMessages');
        this.input = document.getElementById('aiInput');
        this.sendBtn = document.getElementById('aiSend');
        this.suggestions = document.getElementById('aiSuggestions');
        this.langPop = document.getElementById('romiLangPop');

        if (!this.fab || !this.popup || !this.input) return;

        const inputWrap = this.input.closest('.ai-assistant-input');
        if (this.suggestions && inputWrap && !this.suggestions.closest('.ai-assistant-dock')) {
            const dock = document.createElement('div');
            dock.className = 'ai-assistant-dock';
            this.suggestions.parentNode.insertBefore(dock, this.suggestions);
            dock.appendChild(this.suggestions);
            dock.appendChild(inputWrap);
        }

        if (!this.bound) {
            document.addEventListener('click', (e) => {
                const trigger = e.target.closest('.nav-link.ai-link, [data-open-ai]');
                if (trigger) {
                    e.preventDefault();
                    this.open();
                    return;
                }
                if (this.langPop && this.langPop.classList.contains('open')
                    && !e.target.closest('#romiLangPop') && !e.target.closest('#aiFab')) {
                    this.langPop.classList.remove('open');
                }
            });
            this.bound = true;
        }

        this.fab.onclick = (e) => {
            e.stopPropagation();
            if (e.shiftKey || e.altKey) {
                this.toggleLang();
                return;
            }
            this.toggle();
        };
        this.fab.oncontextmenu = (e) => {
            e.preventDefault();
            this.toggleLang();
        };
        if (this.closeBtn) this.closeBtn.onclick = () => this.close();
        if (this.sendBtn) this.sendBtn.onclick = () => this.sendMessage();
        this.input.onkeypress = (e) => {
            if (e.key === 'Enter') this.sendMessage();
        };
        this.suggestions?.querySelectorAll('.ai-suggestion-chip').forEach(chip => {
            chip.onclick = () => {
                this.input.value = chip.dataset.question;
                this.sendMessage();
            };
        });
        const translateBtn = document.getElementById('romiTranslateBtn');
        if (translateBtn) translateBtn.onclick = () => this.runTranslate('text');
        const micBtn = document.getElementById('romiMicBtn');
        if (micBtn) micBtn.onclick = (e) => {
            e.stopPropagation();
            this.startVoice();
        };
        const langClose = document.getElementById('romiLangClose');
        if (langClose) langClose.onclick = (e) => {
            e.stopPropagation();
            this.langPop?.classList.remove('open');
        };
        const speakBtn = document.getElementById('romiSpeakBtn');
        if (speakBtn) speakBtn.onclick = () => {
            const out = document.getElementById('romiLangOut');
            const lang = document.getElementById('romiTgtLang')?.value || 'hi';
            if (out && out.dataset.text) roamitraSpeak(out.dataset.text, lang);
        };
        const navToggle = document.getElementById('roaminiNavToggle');
        if (navToggle) navToggle.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleDrawer();
        };
        const drawerToggle = document.getElementById('roaminiDrawerToggle');
        if (drawerToggle) drawerToggle.onclick = () => this.closeDrawer();
        const drawerClose = document.getElementById('roaminiDrawerClose');
        if (drawerClose) drawerClose.onclick = () => this.closeDrawer();
        const backdrop = document.getElementById('roaminiBackdrop');
        if (backdrop) backdrop.onclick = () => this.closeDrawer();
        const newPlan = document.getElementById('roaminiNewPlan');
        if (newPlan) newPlan.onclick = () => this.openPlan();
        const tripSearch = document.getElementById('roaminiTripSearch');
        if (tripSearch) tripSearch.oninput = () => this.paintTrips();
        roamitraLoadVoices();

        if (!document.getElementById('romiLangHint')) {
            const hint = document.createElement('button');
            hint.id = 'romiLangHint';
            hint.type = 'button';
            hint.className = 'ai-lang-fab';
            hint.setAttribute('aria-label', 'Translate');
            hint.innerHTML = '<i class="bi bi-translate"></i>';
            hint.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleLang();
            });
            this.fab.parentNode.insertBefore(hint, this.fab);
        }
    },

    toggleLang() {
        this.langPop?.classList.toggle('open');
    },

    toggleDrawer() {
        const drawer = document.getElementById('roaminiDrawer');
        if (!drawer) return;
        if (drawer.classList.contains('open')) this.closeDrawer();
        else this.openDrawer();
    },

    openDrawer() {
        document.getElementById('roaminiDrawer')?.classList.add('open');
        document.getElementById('roaminiBackdrop')?.classList.add('open');
        document.getElementById('roaminiNavToggle')?.setAttribute('aria-expanded', 'true');
        this.showTripList();
        this.loadDrawerTrips();
    },

    closeDrawer() {
        const drawer = document.getElementById('roaminiDrawer');
        drawer?.classList.remove('open', 'planning');
        document.getElementById('roaminiBackdrop')?.classList.remove('open');
        document.getElementById('roaminiNavToggle')?.setAttribute('aria-expanded', 'false');
    },

    showTripList() {
        document.getElementById('roaminiDrawer')?.classList.remove('planning');
    },

    async loadDrawerTrips() {
        this.drawerTrips = [];
        const userBox = document.getElementById('roaminiUser');
        let user = null;
        try {
            user = typeof RoamitraApi !== 'undefined' ? await RoamitraApi.me() : null;
        } catch (e) { user = null; }
        if (userBox) {
            if (!user) {
                const login = typeof RoamitraApi !== 'undefined' ? RoamitraApi.page('login.html') : 'login.html';
                userBox.innerHTML = `<a href="${login}">Log in to see your trips</a>`;
            } else {
                const initial = String(user.full_name || 'U').trim().charAt(0).toUpperCase();
                const photo = user.avatar_url
                    ? `<img src="${user.avatar_url}" alt="">`
                    : `<span class="roamini-user-fallback">${initial}</span>`;
                userBox.innerHTML = `${photo}<div><strong>${this.escapeHtml(user.full_name || 'Traveler')}</strong><span>${this.escapeHtml(user.email || '')}</span></div>`;
            }
        }
        if (!user) {
            this.paintTrips();
            return;
        }
        try {
            const data = await RoamitraApi.get('/profile');
            this.drawerTrips = data.trips || [];
        } catch (e) {
            this.drawerTrips = [];
        }
        this.paintTrips();
    },

    paintTrips() {
        const box = document.getElementById('roaminiTripList');
        if (!box) return;
        const q = (document.getElementById('roaminiTripSearch')?.value || '').trim().toLowerCase();
        const trips = (this.drawerTrips || []).filter((t) => !q || String(t.destination || '').toLowerCase().includes(q));
        const today = new Date().toISOString().slice(0, 10);
        const groups = { upcoming: [], draft: [], saved: [] };
        trips.forEach((trip) => {
            if (Number(trip.is_saved) === 1) groups.saved.push(trip);
            else if (trip.status === 'draft' || trip.status === 'planning') groups.draft.push(trip);
            else if (String(trip.start_date || '') >= today) groups.upcoming.push(trip);
            else groups.saved.push(trip);
        });
        const section = (label, items, empty) => {
            const rows = items.length
                ? items.map((trip) => {
                    const when = trip.status === 'draft' || trip.status === 'planning'
                        ? (trip.status === 'draft' ? 'In progress' : 'Planning')
                        : (Number(trip.is_saved) === 1
                            ? this.tripDays(trip) + ' days'
                            : `${this.shortDate(trip.start_date)} - ${this.shortDate(trip.end_date)}`);
                    return `<button type="button" class="roamini-trip" data-trip="${trip.id}"><i class="bi bi-calendar3"></i><span><strong>${this.escapeHtml(trip.destination || 'Trip')}</strong><span>${this.escapeHtml(when)}</span></span></button>`;
                }).join('')
                : `<p class="small" style="opacity:.65">${empty}</p>`;
            return `<div class="roamini-group-label">${label}</div>${rows}`;
        };
        box.innerHTML = section('UPCOMING TRIPS', groups.upcoming, 'No upcoming trips yet.')
            + section('DRAFT TRIPS', groups.draft, 'No drafts yet.')
            + section('SAVED TRIPS', groups.saved, 'No saved trips yet.');
        box.querySelectorAll('[data-trip]').forEach((btn) => {
            btn.onclick = () => {
                window.location.href = (typeof RoamitraApi !== 'undefined' ? RoamitraApi.page('itinerary.html') : 'itinerary.html')
                    + '?trip=' + encodeURIComponent(btn.dataset.trip);
            };
        });
    },

    shortDate(value) {
        if (!value) return '';
        const date = new Date(String(value).slice(0, 10) + 'T00:00:00');
        if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    tripDays(trip) {
        const start = new Date(String(trip.start_date || '').slice(0, 10) + 'T00:00:00');
        const end = new Date(String(trip.end_date || '').slice(0, 10) + 'T00:00:00');
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
        return Math.max(1, Math.round((end - start) / 86400000) + 1);
    },

    openPlan(prefill) {
        this.openDrawer();
        const drawer = document.getElementById('roaminiDrawer');
        const plan = document.getElementById('roaminiPlan');
        if (!drawer || !plan) return;
        drawer.classList.add('planning');
        const styles = [
            ['luxury', 'Luxury', '✨'],
            ['local', 'Local', '📍'],
            ['adventure', 'Adventure', '💼'],
            ['food', 'Food Explorer', '🍴'],
            ['solo', 'Solo Explorer', '🎒'],
            ['nature', 'Nature Escape', '🌿'],
            ['slow', 'Slow Travel', '⏱️'],
            ['custom', 'Your Choice', '✏️']
        ];
        const withWho = ['solo', 'couple', 'family', 'friends', 'group'];
        const times = ['morning', 'afternoon', 'evening', 'late_night'];
        plan.innerHTML = `
            <div class="roamini-plan-head">
                <button type="button" class="roamini-icon-btn" id="roaminiPlanBack" aria-label="Back to trips"><i class="bi bi-list"></i></button>
                <div><strong>Roamini AI</strong><span class="roamini-plan-sub">AI-powered travel planning</span></div>
            </div>
            <form class="roamini-drawer-body" id="roaminiPlanForm">
                <div style="text-align:center;margin:0.4rem 0 1rem;">
                    <div style="width:64px;height:64px;border-radius:18px;background:#10284f;color:#3dde6a;display:inline-flex;align-items:center;justify-content:center;font-size:1.6rem;"><i class="bi bi-geo-alt"></i></div>
                    <h3 style="margin:0.8rem 0 0.2rem;font-size:1.35rem;">Plan with Roamini AI</h3>
                    <p style="margin:0;color:#6b7c90;">Answer a few questions and let AI create your perfect itinerary</p>
                </div>
                <div class="roamini-field">
                    <label for="romiDest"><i class="bi bi-geo-alt"></i> Where are you going?</label>
                    <input id="romiDest" required placeholder="Bali, Indonesia">
                </div>
                <div class="roamini-field">
                    <label for="romiDays"><i class="bi bi-calendar3"></i> How many days?</label>
                    <input id="romiDays" type="number" min="1" max="30" value="3" required>
                </div>
                <div class="roamini-field">
                    <label for="romiBudget"><i class="bi bi-currency-dollar"></i> Your budget (USD)</label>
                    <input id="romiBudget" type="number" min="0" step="1" placeholder="325">
                </div>
                <div class="roamini-field">
                    <label>Who are you traveling with?</label>
                    <div class="roamini-choice-row">${withWho.map((v, i) => `<label><input type="radio" name="romiWith" value="${v}" ${i === 0 ? 'checked' : ''}> ${v[0].toUpperCase() + v.slice(1)}</label>`).join('')}</div>
                </div>
                <div class="roamini-field" id="romiGroupWrap" hidden>
                    <label for="romiGroup">How many people are traveling?</label>
                    <input id="romiGroup" type="number" min="3" max="12" placeholder="4">
                </div>
                <div class="roamini-field">
                    <label>Arrival time</label>
                    <div class="roamini-choice-row">${times.map((v, i) => `<label><input type="radio" name="romiArrive" value="${v}" ${i === 0 ? 'checked' : ''}> ${v.replace('_', ' ')}</label>`).join('')}</div>
                </div>
                <div class="roamini-field">
                    <label>Departure time</label>
                    <div class="roamini-choice-row">${times.map((v, i) => `<label><input type="radio" name="romiDepart" value="${v}" ${i === 2 ? 'checked' : ''}> ${v.replace('_', ' ')}</label>`).join('')}</div>
                </div>
                <div class="roamini-field">
                    <label>Travel Style <span style="font-weight:500;color:#6b7c90;">(Multi-select)</span></label>
                    <div class="roamini-style-grid">${styles.map(([id, label, emo]) => `<button type="button" class="roamini-style" data-style="${id}"><span class="emo">${emo}</span>${label}</button>`).join('')}</div>
                </div>
                <p id="romiPlanStatus" class="small" hidden></p>
                <button type="submit" class="roamini-generate" id="romiGenerate">Generate My Itinerary</button>
                <p class="roamini-plan-note">AI will generate a personalized plan with activities</p>
            </form>`;
        document.getElementById('roaminiPlanBack').onclick = () => this.showTripList();
        plan.querySelectorAll('.roamini-style').forEach((btn) => {
            btn.onclick = () => {
                btn.classList.toggle('selected');
                this.refreshPlanButton();
            };
        });
        plan.querySelectorAll('input').forEach((input) => {
            input.addEventListener('input', () => this.refreshPlanButton());
            input.addEventListener('change', () => {
                if (input.name === 'romiWith') {
                    const wrap = document.getElementById('romiGroupWrap');
                    if (wrap) wrap.hidden = input.value !== 'group' || !input.checked;
                }
                this.refreshPlanButton();
            });
        });
        document.getElementById('roaminiPlanForm').onsubmit = (e) => this.submitPlan(e);
        if (prefill && prefill.destination) document.getElementById('romiDest').value = prefill.destination;
        if (prefill && prefill.id) this.fillPlanFromTrip(prefill.id);
        this.refreshPlanButton();
    },

    refreshPlanButton() {
        const btn = document.getElementById('romiGenerate');
        const dest = document.getElementById('romiDest');
        if (!btn || !dest) return;
        btn.classList.toggle('ready', dest.value.trim().length > 1);
    },

    async fillPlanFromTrip(id) {
        try {
            const data = await RoamitraApi.get('/trips/' + id);
            const trip = data.trip || {};
            const dest = document.getElementById('romiDest');
            const days = document.getElementById('romiDays');
            const budget = document.getElementById('romiBudget');
            if (dest) dest.value = trip.destination || '';
            if (days) days.value = String(this.tripDays(trip));
            if (budget && trip.budget != null) budget.value = trip.budget;
            const withRadio = document.querySelector(`input[name="romiWith"][value="${trip.traveling_with}"]`);
            if (withRadio) withRadio.checked = true;
            const arrive = document.querySelector(`input[name="romiArrive"][value="${trip.arrival_time}"]`);
            const depart = document.querySelector(`input[name="romiDepart"][value="${trip.departure_time}"]`);
            if (arrive) arrive.checked = true;
            if (depart) depart.checked = true;
            document.getElementById('roaminiPlanForm').dataset.edit = String(id);
            this.refreshPlanButton();
        } catch (e) { /* new plan if the trip cannot be loaded */ }
    },

    async submitPlan(e) {
        e.preventDefault();
        const form = document.getElementById('roaminiPlanForm');
        const status = document.getElementById('romiPlanStatus');
        const btn = document.getElementById('romiGenerate');
        const user = typeof RoamitraApi !== 'undefined' ? await RoamitraApi.me() : null;
        if (!user) {
            window.location.href = RoamitraApi.page('login.html') + '?next=' + encodeURIComponent(location.pathname.split('/').pop() || 'explore.html');
            return;
        }
        const destination = document.getElementById('romiDest').value.trim();
        const days = Math.max(1, Math.min(30, Number(document.getElementById('romiDays').value) || 1));
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + days - 1);
        const iso = (d) => d.toISOString().slice(0, 10);
        const withWho = document.querySelector('input[name="romiWith"]:checked')?.value || 'solo';
        const styles = [...form.querySelectorAll('.roamini-style.selected')].map((el) => el.dataset.style);
        const prefMap = { luxury: 'shopping', local: 'culture', adventure: 'adventure', food: 'food', nature: 'nature', solo: 'beach', custom: 'art' };
        const data = {
            destination,
            start_date: iso(start),
            end_date: iso(end),
            budget: document.getElementById('romiBudget').value,
            traveling_with: styles.includes('solo') ? 'solo' : withWho,
            group_size: document.getElementById('romiGroup')?.value || '',
            arrival_time: document.querySelector('input[name="romiArrive"]:checked')?.value || 'morning',
            departure_time: document.querySelector('input[name="romiDepart"]:checked')?.value || 'evening',
            pace: styles.includes('slow') ? 'relaxed' : 'moderate',
            preferences: styles.map((s) => prefMap[s]).filter(Boolean)
        };
        btn.disabled = true;
        btn.textContent = 'Creating trip…';
        try {
            let tripId = form.dataset.edit || '';
            if (tripId) {
                const updated = await RoamitraApi.post('/trips/' + tripId + '/update', data);
                tripId = updated.trip.id;
            } else {
                const created = await RoamitraApi.post('/trips', data);
                tripId = created.trip.id;
            }
            btn.textContent = 'Generating itinerary…';
            const gen = await RoamitraApi.post('/trips/' + tripId + '/generate', {});
            window.location.href = RoamitraApi.page('itinerary.html') + '?trip=' + gen.trip.id;
        } catch (err) {
            status.hidden = false;
            status.textContent = err.message || 'Could not generate that itinerary.';
            btn.disabled = false;
            btn.textContent = 'Generate My Itinerary';
        }
    },

    async runTranslate(mode) {
        const out = document.getElementById('romiLangOut');
        const speakBtn = document.getElementById('romiSpeakBtn');
        const text = document.getElementById('romiSrcText')?.value.trim();
        const source = document.getElementById('romiSrcLang')?.value || 'en';
        const target = document.getElementById('romiTgtLang')?.value || 'hi';
        if (!out) return;
        out.hidden = false;
        if (!text) {
            out.textContent = 'Type a phrase, or tap Speak.';
            return;
        }
        out.textContent = 'Translating…';
        if (speakBtn) speakBtn.hidden = true;
        let translated = '';
        try {
            const data = await RoamitraApi.post('/translate', {
                text,
                source_lang: source,
                target_lang: target,
                mode: mode === 'voice' ? 'voice' : 'text'
            });
            translated = data.translated_text || data.translated || data.text || '';
        } catch (err) {
            try {
                translated = await roamitraTranslateDirect(text, source, target);
            } catch (fallbackErr) {
                out.textContent = err.message || 'Could not translate right now.';
                return;
            }
        }
        if (!translated) {
            out.textContent = 'Could not translate right now.';
            return;
        }
        out.dataset.text = translated;
        out.textContent = translated;
        if (speakBtn) speakBtn.hidden = false;
        if (mode === 'voice') roamitraSpeak(translated, target);
    },

    startVoice() {
        const mic = document.getElementById('romiMicBtn');
        const input = document.getElementById('romiSrcText');
        const out = document.getElementById('romiLangOut');
        const setSpeak = (listening) => {
            if (!mic) return;
            mic.classList.toggle('listening', listening);
            mic.setAttribute('aria-pressed', listening ? 'true' : 'false');
            mic.innerHTML = listening
                ? '<i class="bi bi-stop-fill"></i> <span>Stop</span>'
                : '<i class="bi bi-mic"></i> <span>Speak</span>';
        };
        if (this.voiceStop) {
            const stop = this.voiceStop;
            this.voiceStop = null;
            setSpeak(false);
            stop();
            return;
        }
        setSpeak(true);
        this.voiceStop = window.RoamitraVoice.listen({
            lang: document.getElementById('romiSrcLang')?.value || 'en',
            onStatus: (msg) => {
                if (!out) return;
                out.hidden = false;
                out.textContent = msg;
            },
            onText: (text) => {
                this.voiceStop = null;
                setSpeak(false);
                if (input) input.value = text;
                this.runTranslate('voice');
            },
            onError: (msg) => {
                this.voiceStop = null;
                setSpeak(false);
                if (!out) return;
                out.hidden = false;
                out.textContent = msg;
            }
        });
    },

    toggle() {
        this.isOpen ? this.close() : this.open();
    },

    open() {
        this.ensureWidget();
        this.init();
        if (!this.popup) return;
        this.isOpen = true;
        this.popup.classList.add('open');
        this.fab?.classList.add('active');
        document.body.classList.add('roamini-open');
        this.langPop?.classList.remove('open');
        this.maybeDailyWelcome();
        this.input?.focus();
    },

    close() {
        this.isOpen = false;
        this.popup?.classList.remove('open');
        this.fab?.classList.remove('active');
        document.body.classList.remove('roamini-open');
    },

    async maybeDailyWelcome() {
        const today = new Date().toISOString().slice(0, 10);
        try {
            if (localStorage.getItem(this.welcomeKey) === today) return;
            localStorage.setItem(this.welcomeKey, today);
        } catch (e) {
            /* private mode — still greet this open */
        }
        let name = '';
        try {
            const user = typeof RoamitraApi !== 'undefined' ? await RoamitraApi.me() : null;
            name = (user && String(user.full_name || '').trim().split(/\s+/)[0]) || '';
        } catch (e) { /* guest */ }
        const hour = new Date().getHours();
        const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        const text = name
            ? `${part}, ${name}! Welcome to Roamini. I can help with travel, Roamitra, or any question you have today.`
            : `${part}! Welcome to Roamini. Ask me anything — destinations, rentals, hosts, or any other question.`;
        if (this.messages) this.messages.innerHTML = '';
        this.addMessage(text, 'bot');
        this.conversationHistory = [{ role: 'assistant', content: text }];
    },

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text || this.isTyping) return;

        this.addMessage(text, 'user');
        this.input.value = '';
        this.conversationHistory.push({ role: 'user', content: text });

        this.showTyping();
        let response = '';
        try {
            if (typeof RoamitraApi !== 'undefined') {
                const data = await RoamitraApi.post('/roamini/chat', {
                    message: text,
                    history: this.conversationHistory.slice(0, -1).slice(-10),
                });
                response = (data && (data.reply || data.message || data.text)) || '';
            }
        } catch (err) {
            response = '';
        }
        if (!response) {
            response = this.getResponse(text);
        }
        this.hideTyping();
        this.addMessage(response, 'bot');
        this.conversationHistory.push({ role: 'assistant', content: response });
    },

    getResponse(text) {
        const lower = text.toLowerCase();
        if (/^(hi|hello|hey|yo|namaste)\b/i.test(text)) {
            return 'Hello! I am Roamini. Ask me about destinations, Ask to Rent, Ask to Host, trip planning, or how to use the site.';
        }
        if (/\b(log ?in|sign ?in|sigin|signin|login)\b/i.test(text)) {
            return 'To sign in: click Log in at the top right, enter your email and password, then submit. Use Sign up first if you do not have an account.';
        }
        if (lower.includes('sign up') || lower.includes('register')) {
            return 'Click Sign up at the top right, enter your name, email, and password, then submit. After that, Log in with the same email.';
        }
        for (const [key, response] of Object.entries(this.faqResponses)) {
            if (key !== 'default' && lower.includes(key)) {
                return response;
            }
        }
        return 'I can walk you through Roamitra: Log in, Sign up, Explore, Plan Trip, Community, Ask to Rent, or Ask to Host. Ask “how to sign in” or “what is Bali” for a direct answer.';
    },

    addMessage(text, type) {
        const msg = document.createElement('div');
        msg.className = `ai-message ${type}`;
        const body = type === 'bot' ? this.formatBotHtml(text) : this.escapeHtml(text);
        msg.innerHTML = `
            <div class="ai-message-avatar">
                ${type === 'bot'
                    ? `<img src="${(typeof RoamitraApi !== 'undefined' ? RoamitraApi.basePath() : '')}assets/images/ai-bot.jpeg" alt="" class="ai-bot-photo">`
                    : '<i class="bi bi-person-fill"></i>'}
            </div>
            <div class="ai-message-bubble">${body}</div>
        `;
        this.messages.appendChild(msg);
        this.scrollToBottom();
    },

    formatBotHtml(text) {
        const raw = String(text || '').trim();
        const esc = this.escapeHtml(raw);
        const greeting = /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(raw);
        const instructional = /^(to sign|to create|to become|open community|click |use plan trip|on roamitra you can)/i.test(raw);
        const parts = esc.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter(Boolean);
        if (instructional && parts.length >= 2) {
            return '<ol class="ai-steps">' + parts.map((p) => `<li>${p}</li>`).join('') + '</ol>';
        }
        if (greeting || parts.length <= 1) {
            return `<p>${esc}</p>`;
        }
        return parts.map((p) => `<p>${p}</p>`).join('');
    },

    showTyping() {
        this.isTyping = true;
        if (this.sendBtn) this.sendBtn.disabled = true;
        const typing = document.createElement('div');
        typing.className = 'ai-message bot';
        typing.id = 'aiTyping';
        typing.innerHTML = `
            <div class="ai-message-avatar"><img src="${(typeof RoamitraApi !== 'undefined' ? RoamitraApi.basePath() : '')}assets/images/ai-bot.jpeg" alt="" class="ai-bot-photo"></div>
            <div class="ai-typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        this.messages.appendChild(typing);
        this.scrollToBottom();
    },

    hideTyping() {
        this.isTyping = false;
        if (this.sendBtn) this.sendBtn.disabled = false;
        document.getElementById('aiTyping')?.remove();
    },

    scrollToBottom() {
        requestAnimationFrame(() => {
            this.messages.scrollTop = this.messages.scrollHeight;
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    RoamitraAI.mount();
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');
    const destination = params.get('destination');
    if ((plan || destination) && document.body.dataset.page !== 'roamini') {
        const q = new URLSearchParams();
        if (plan) q.set('plan', plan);
        if (destination) q.set('destination', destination);
        window.location.replace(RoamitraApi.page('roamini.html') + '?' + q.toString());
    }
});
