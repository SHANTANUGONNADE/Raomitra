const LANGS = [
    ['en', 'English'], ['hi', 'Hindi'], ['es', 'Spanish'], ['fr', 'French'],
    ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ja', 'Japanese'],
    ['ko', 'Korean'], ['zh-CN', 'Chinese (Simplified)'], ['ar', 'Arabic'],
    ['ru', 'Russian'], ['ta', 'Tamil'], ['te', 'Telugu'], ['kn', 'Kannada'],
    ['ml', 'Malayalam'], ['bn', 'Bengali'], ['mr', 'Marathi'], ['gu', 'Gujarati'],
    ['th', 'Thai'], ['vi', 'Vietnamese'], ['tr', 'Turkish'], ['nl', 'Dutch']
];

function speechLang(code) {
    const map = { en: 'en-US', hi: 'hi-IN', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-BR', ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA', ru: 'ru-RU', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', bn: 'bn-IN', mr: 'mr-IN', gu: 'gu-IN', th: 'th-TH', vi: 'vi-VN', tr: 'tr-TR', nl: 'nl-NL' };
    if (code === 'zh-CN' || code === 'zh') return 'zh-CN';
    return map[code] || code || 'en-US';
}

function loadVoices() {
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

async function translateFallback(text, source, target) {
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

document.addEventListener('DOMContentLoaded', async () => {
    loadVoices();
    const source = document.getElementById('sourceLang');
    const target = document.getElementById('targetLang');
    LANGS.forEach(([code, label]) => {
        source.add(new Option(label, code));
        target.add(new Option(label, code));
    });
    source.value = 'en';
    target.value = 'hi';
    const user = await RoamitraApi.me();

    async function loadHistory() {
        if (!user) return;
        try {
            const hist = await RoamitraApi.get('/translate/history');
            if (hist.prefs) {
                if (!source.dataset.locked) {
                    source.value = hist.prefs.source_lang || source.value;
                    target.value = hist.prefs.target_lang || target.value;
                }
            }
            renderHistory(hist.history || []);
        } catch (e) { /* guest / offline */ }
    }

    if (user) {
        await loadHistory();
    }

    document.getElementById('swapLangs')?.addEventListener('click', () => {
        const s = source.value;
        source.value = target.value;
        target.value = s;
        source.dataset.locked = '1';
    });

    const form = document.getElementById('translateForm');
    const status = document.getElementById('translateStatus');
    const result = document.getElementById('translateResult');
    const speakBtn = document.getElementById('speakResult');
    const micBtn = document.getElementById('micBtn');
    const input = document.getElementById('sourceText');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await runTranslate('text');
    });

    speakBtn.addEventListener('click', () => {
        const text = result.dataset.text || '';
        if (!text) return;
        speak(text, target.value);
    });

    let stopVoice = null;
    micBtn.addEventListener('click', () => startVoice());

    async function runTranslate(mode) {
        const text = input.value.trim();
        status.hidden = true;
        if (!text) {
            showError('Enter or speak a phrase first.');
            return;
        }
        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        status.hidden = false;
        status.className = 'form-alert';
        status.textContent = 'Translating…';
        try {
            const data = await RoamitraApi.post('/translate', {
                text,
                source_lang: source.value,
                target_lang: target.value,
                mode
            });
            const translated = data.translated_text || data.translated || data.text;
            result.hidden = false;
            result.dataset.text = translated;
            result.querySelector('.translated-text').textContent = translated;
            status.hidden = true;
            if (mode === 'voice') {
                speak(translated, target.value);
            }
            source.dataset.locked = '1';
            await loadHistory();
        } catch (err) {
            try {
                const translated = await translateFallback(text, source.value, target.value);
                result.hidden = false;
                result.dataset.text = translated;
                result.querySelector('.translated-text').textContent = translated;
                status.hidden = true;
                if (mode === 'voice') speak(translated, target.value);
            } catch (fallbackErr) {
                showError(err.message || fallbackErr.message || 'Translation failed.');
            }
        } finally {
            btn.disabled = false;
        }
    }

    function startVoice() {
        const setSpeak = (listening) => {
            micBtn.classList.toggle('listening', listening);
            micBtn.setAttribute('aria-pressed', listening ? 'true' : 'false');
            micBtn.innerHTML = listening
                ? '<i class="bi bi-stop-fill"></i> <span>Stop</span>'
                : '<i class="bi bi-mic"></i> <span>Speak</span>';
        };
        if (stopVoice) {
            const stop = stopVoice;
            stopVoice = null;
            setSpeak(false);
            stop();
            return;
        }
        if (!window.RoamitraVoice) {
            showError('Voice is still loading. Tap Speak again.');
            return;
        }
        setSpeak(true);
        stopVoice = window.RoamitraVoice.listen({
            lang: source.value,
            onStatus: (msg) => {
                status.hidden = false;
                status.className = 'form-alert';
                status.textContent = msg;
            },
            onText: (text) => {
                stopVoice = null;
                setSpeak(false);
                input.value = text;
                runTranslate('voice');
            },
            onError: (msg) => {
                stopVoice = null;
                setSpeak(false);
                showError(msg);
            }
        });
    }

    async function speak(text, lang) {
        if (!window.speechSynthesis) {
            showError('Audio playback is not supported in this browser.');
            return;
        }
        const voices = await loadVoices();
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = speechLang(lang);
        const prefix = u.lang.toLowerCase().slice(0, 2);
        const match = voices.find(v => v.lang.toLowerCase() === u.lang.toLowerCase())
            || voices.find(v => v.lang.toLowerCase().startsWith(prefix));
        if (match) u.voice = match;
        u.rate = 0.95;
        status.hidden = false;
        status.className = 'form-alert';
        status.textContent = 'Playing translation…';
        u.onend = () => { status.hidden = true; };
        u.onerror = () => showError('Could not play the translated audio.');
        window.speechSynthesis.resume();
        setTimeout(() => {
            try {
                window.speechSynthesis.speak(u);
            } catch (e) {
                showError('Could not play the translated audio.');
            }
        }, 60);
    }

    function showError(msg) {
        status.hidden = false;
        status.className = 'form-alert error';
        status.textContent = msg;
    }

    function renderHistory(rows) {
        const box = document.getElementById('translateHistory');
        if (!box) return;
        if (!rows.length) {
            box.innerHTML = '<p class="text-muted">No saved translations yet.</p>';
            return;
        }
        box.innerHTML = rows.map(r => `
            <div class="history-item">
                <div><strong>${escapeHtml(r.source_lang)} → ${escapeHtml(r.target_lang)}</strong> · ${escapeHtml(r.mode)}</div>
                <div>${escapeHtml(r.source_text)}</div>
                <div>${escapeHtml(r.translated_text)}</div>
            </div>
        `).join('');
    }

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }
});
