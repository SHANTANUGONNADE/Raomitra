const LANGS = [
    ['en', 'English'], ['hi', 'Hindi'], ['es', 'Spanish'], ['fr', 'French'],
    ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ja', 'Japanese'],
    ['ko', 'Korean'], ['zh-CN', 'Chinese (Simplified)'], ['ar', 'Arabic'],
    ['ru', 'Russian'], ['ta', 'Tamil'], ['te', 'Telugu'], ['kn', 'Kannada'],
    ['ml', 'Malayalam'], ['bn', 'Bengali'], ['mr', 'Marathi'], ['gu', 'Gujarati'],
    ['th', 'Thai'], ['vi', 'Vietnamese'], ['tr', 'Turkish'], ['nl', 'Dutch']
];

document.addEventListener('DOMContentLoaded', async () => {
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
            result.hidden = false;
            result.dataset.text = data.translated_text;
            result.querySelector('.translated-text').textContent = data.translated_text;
            status.hidden = true;
            if (mode === 'voice') {
                speak(data.translated_text, target.value);
            }
            source.dataset.locked = '1';
            await loadHistory();
        } catch (err) {
            showError(err.message || 'Translation failed.');
        } finally {
            btn.disabled = false;
        }
    }

    function startVoice() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showError('Voice input is not supported in this browser. Try Chrome, or type the phrase instead.');
            return;
        }
        const rec = new SpeechRecognition();
        rec.lang = source.value === 'zh-CN' ? 'zh-CN' : source.value;
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        micBtn.classList.add('listening');
        micBtn.setAttribute('aria-pressed', 'true');
        status.hidden = false;
        status.className = 'form-alert';
        status.textContent = 'Listening… allow microphone access if prompted.';
        rec.onresult = (event) => {
            input.value = event.results[0][0].transcript;
            micBtn.classList.remove('listening');
            runTranslate('voice');
        };
        rec.onerror = (event) => {
            micBtn.classList.remove('listening');
            const map = {
                'not-allowed': 'Microphone permission was denied.',
                'no-speech': 'No speech was detected. Try again.',
                'audio-capture': 'No microphone was found.',
                network: 'Network error during speech recognition.'
            };
            showError(map[event.error] || ('Voice error: ' + event.error));
        };
        rec.onend = () => {
            micBtn.classList.remove('listening');
            micBtn.setAttribute('aria-pressed', 'false');
        };
        try {
            rec.start();
        } catch (e) {
            showError('Could not start the microphone.');
            micBtn.classList.remove('listening');
        }
    }

    function speak(text, lang) {
        if (!window.speechSynthesis) {
            showError('Audio playback is not supported in this browser.');
            return;
        }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === 'zh-CN' ? 'zh-CN' : lang;
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find(v => v.lang.toLowerCase().startsWith(String(u.lang).toLowerCase().slice(0, 2)));
        if (match) u.voice = match;
        status.hidden = false;
        status.className = 'form-alert';
        status.textContent = 'Playing translation…';
        u.onend = () => { status.hidden = true; };
        u.onerror = () => showError('Could not play the translated audio.');
        try {
            window.speechSynthesis.speak(u);
        } catch (e) {
            showError('Could not play the translated audio.');
        }
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
