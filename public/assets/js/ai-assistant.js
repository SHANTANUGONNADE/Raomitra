/**
 * Roamitra — AI Assistant (Frontend UI)
 * Chat popup with typing animation, auto-scroll, and suggestion chips.
 */

const RoamitraAI = {
    isOpen: false,
    isTyping: false,
    conversationHistory: [],
    bound: false,

    faqResponses: {
        'travel packages': 'We offer curated travel packages to 88+ countries including adventure tours, cultural experiences, beach getaways, and city explorations. Browse our Explore page to find packages that match your interests and budget!',
        'become a host': 'To become a host, log in and open Become a Host. Submit your city, phone, and a short bio. A Co-Admin reviews it, then Admin approval makes you a verified host. Vehicle owners can use List Your Vehicle on the same form.',
        'cancellation policy': 'Our cancellation policy varies by listing type. Most bookings can be cancelled up to 48 hours before for a full refund. Vehicle rentals and meetups may have different terms — check the specific listing for details.',
        'booking process': 'Open Ask to Rent, choose a vehicle, and click Book Now. Pick pickup and return dates, then confirm. You must be logged in. Your booking is saved to your profile and appears on the Admin dashboard.',
        'destinations': 'We feature destinations across 88 countries! Popular spots include Bali, Tokyo, Paris, Yosemite, and Bangalore. Use the Explore page to discover featured destinations and insider tips from verified locals.',
        'host registration': 'Host registration requires: a verified customer account, completed application form, identity documents, and property/vehicle details. The review process typically takes 3-5 business days.',
        'faq': 'Common questions: How do I book? Create an account, search, and book. How do I become a host? Apply via your profile. What payment methods? Credit/debit cards and secure online payments. Need more help? Visit our Help Center!',
        'default': 'Thanks for your question! I\'m here to help with travel packages, destinations, bookings, host registration, and more. Could you provide a bit more detail so I can assist you better?'
    },

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
            && document.getElementById('aiClose');
        if (complete) {
            return;
        }
        document.getElementById('aiFab')?.remove();
        document.getElementById('aiPopup')?.remove();
        const src = (typeof RoamitraApi !== 'undefined' ? RoamitraApi.basePath() : '') + 'assets/images/ai-bot.jpeg';
        document.body.insertAdjacentHTML('beforeend', `
            <button class="ai-assistant-fab" id="aiFab" aria-label="Open Roamitra AI Assistant">
                <img src="${src}" alt="" class="ai-bot-photo">
            </button>
            <div class="ai-assistant-popup" id="aiPopup" role="dialog" aria-label="Roamitra AI Chat">
                <div class="ai-assistant-header">
                    <div class="ai-assistant-header-info">
                        <div class="ai-assistant-avatar"><img src="${src}" alt="" class="ai-bot-photo"></div>
                        <div>
                            <h4>Roamitra AI</h4>
                            <p>Your travel assistant</p>
                        </div>
                    </div>
                    <button class="ai-assistant-close" id="aiClose" type="button" aria-label="Close chat">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="ai-assistant-messages" id="aiMessages">
                    <div class="ai-message bot">
                        <div class="ai-message-avatar"><img src="${src}" alt="" class="ai-bot-photo"></div>
                        <div class="ai-message-bubble">Hi! I'm Roamitra AI, your travel assistant. How can I help you today?</div>
                    </div>
                </div>
                <div class="ai-assistant-suggestions" id="aiSuggestions">
                    <button type="button" class="ai-suggestion-chip" data-question="What travel packages do you offer?">Travel Packages</button>
                    <button type="button" class="ai-suggestion-chip" data-question="How do I become a host?">Become a Host</button>
                    <button type="button" class="ai-suggestion-chip" data-question="What is the cancellation policy?">Cancellation Policy</button>
                    <button type="button" class="ai-suggestion-chip" data-question="How does booking work?">Booking Process</button>
                </div>
                <div class="ai-assistant-input">
                    <input type="text" id="aiInput" placeholder="Ask me anything about travel..." autocomplete="off">
                    <button type="button" id="aiSend" aria-label="Send message"><i class="bi bi-send-fill"></i></button>
                </div>
            </div>
        `);
    },

    init() {
        this.fab = document.getElementById('aiFab');
        this.popup = document.getElementById('aiPopup');
        this.closeBtn = document.getElementById('aiClose');
        this.messages = document.getElementById('aiMessages');
        this.input = document.getElementById('aiInput');
        this.sendBtn = document.getElementById('aiSend');
        this.suggestions = document.getElementById('aiSuggestions');

        if (!this.fab || !this.popup || !this.input) return;

        if (!this.bound) {
            document.addEventListener('click', (e) => {
                const trigger = e.target.closest('.nav-link.ai-link, .search-ai-btn .btn-roamitra-ai, button.btn-roamitra-ai, [data-open-ai]');
                if (!trigger) return;
                e.preventDefault();
                this.open();
            });
            this.bound = true;
        }

        this.fab.onclick = () => this.toggle();
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
        this.input?.focus();
    },

    close() {
        this.isOpen = false;
        this.popup?.classList.remove('open');
        this.fab?.classList.remove('active');
    },

    sendMessage() {
        const text = this.input.value.trim();
        if (!text || this.isTyping) return;

        this.addMessage(text, 'user');
        this.input.value = '';
        this.conversationHistory.push({ role: 'user', content: text });

        this.showTyping();
        setTimeout(() => {
            this.hideTyping();
            const response = this.getResponse(text);
            this.addMessage(response, 'bot');
            this.conversationHistory.push({ role: 'assistant', content: response });
        }, 1200 + Math.random() * 800);
    },

    getResponse(text) {
        const lower = text.toLowerCase();
        for (const [key, response] of Object.entries(this.faqResponses)) {
            if (key !== 'default' && lower.includes(key)) {
                return response;
            }
        }
        return this.faqResponses.default;
    },

    addMessage(text, type) {
        const msg = document.createElement('div');
        msg.className = `ai-message ${type}`;
        msg.innerHTML = `
            <div class="ai-message-avatar">
                ${type === 'bot'
                    ? `<img src="${(typeof RoamitraApi !== 'undefined' ? RoamitraApi.basePath() : '')}assets/images/ai-bot.jpeg" alt="" class="ai-bot-photo">`
                    : '<i class="bi bi-person-fill"></i>'}
            </div>
            <div class="ai-message-bubble">${this.escapeHtml(text)}</div>
        `;
        this.messages.appendChild(msg);
        this.scrollToBottom();
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
        const typing = document.getElementById('aiTyping');
        if (typing) typing.remove();
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
