/**
 * Roamini — fullscreen travel assistant
 */

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
            && document.getElementById('romiLangPop');
        if (complete) {
            this.renameLabels();
            return;
        }
        document.getElementById('aiFab')?.remove();
        document.getElementById('aiPopup')?.remove();
        document.getElementById('romiLangPop')?.remove();
        const src = (typeof RoamitraApi !== 'undefined' ? RoamitraApi.basePath() : '') + 'assets/images/ai-bot.jpeg';
        const langOpts = this.langs.map(([code, label]) => `<option value="${code}">${label}</option>`).join('');
        document.body.insertAdjacentHTML('beforeend', `
            <button class="ai-assistant-fab" id="aiFab" aria-label="Open Roamini">
                <img src="${src}" alt="" class="ai-bot-photo">
            </button>
            <div class="romi-lang-pop" id="romiLangPop" role="dialog" aria-label="Translate">
                <h5><i class="bi bi-translate"></i> Translate</h5>
                <div class="romi-lang-row">
                    <select id="romiSrcLang">${langOpts}</select>
                    <select id="romiTgtLang">${langOpts}</select>
                </div>
                <textarea id="romiSrcText" placeholder="Type a phrase…"></textarea>
                <button type="button" class="btn-roamitra btn-roamitra-navy btn-roamitra-sm" id="romiTranslateBtn">Translate</button>
                <p id="romiLangOut" class="small mt-2 mb-0"></p>
                <a class="small" href="${typeof RoamitraApi !== 'undefined' ? RoamitraApi.page('translator.html') : 'translator.html'}">Open full translator</a>
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
        document.getElementById('romiTranslateBtn')?.addEventListener('click', () => this.runTranslate());

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

    async runTranslate() {
        const out = document.getElementById('romiLangOut');
        const text = document.getElementById('romiSrcText')?.value.trim();
        if (!out) return;
        if (!text) {
            out.textContent = 'Type a phrase first.';
            return;
        }
        out.textContent = 'Translating…';
        try {
            const data = await RoamitraApi.post('/translate', {
                text,
                source_lang: document.getElementById('romiSrcLang').value,
                target_lang: document.getElementById('romiTgtLang').value
            });
            out.textContent = data.translated || data.text || JSON.stringify(data);
        } catch (err) {
            out.textContent = err.message || 'Could not translate right now.';
        }
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
});
