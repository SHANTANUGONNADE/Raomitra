/**
 * Roamitra — scroll reveals, sliding nav highlight, card tilt
 */
(function initRoamitraMotion() {
    if (window.__roamitraMotion) return;
    window.__roamitraMotion = true;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const start = () => {
        const onScroll = () => {
            document.querySelector('.roamitra-navbar')?.classList.toggle('is-scrolled', window.scrollY > 8);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        initNavLiquid();
        if (reduced) return;
        initReveals();
        initCardTilt();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(start, 40));
    } else {
        setTimeout(start, 40);
    }

    function initNavLiquid() {
        const list = document.querySelector('.roamitra-nav-links');
        if (!list) return;
        let blob = list.querySelector('.nav-liquid');
        if (!blob) {
            blob = document.createElement('span');
            blob.className = 'nav-liquid';
            list.insertBefore(blob, list.firstChild);
        }

        const moveTo = (el) => {
            if (!el || el.classList.contains('ai-link')) {
                const active = list.querySelector('.nav-link.active:not(.ai-link)');
                if (active) moveTo(active);
                else blob.classList.remove('on');
                return;
            }
            const item = el.closest('li') || el;
            const parent = blob.offsetParent || list;
            const pr = parent.getBoundingClientRect();
            const r = item.getBoundingClientRect();
            blob.style.width = r.width + 'px';
            blob.style.height = r.height + 'px';
            blob.style.top = '0px';
            blob.style.left = '0px';
            blob.style.transform = 'translate(' + (r.left - pr.left) + 'px,' + (r.top - pr.top) + 'px)';
            blob.classList.add('on');
        };

        const active = list.querySelector('.nav-link.active:not(.ai-link)') || list.querySelector('.nav-link:not(.ai-link)');
        requestAnimationFrame(() => moveTo(active));

        list.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('mouseenter', () => moveTo(link));
        });
        list.addEventListener('mouseleave', () => {
            moveTo(list.querySelector('.nav-link.active:not(.ai-link)'));
        });
        window.addEventListener('resize', () => {
            moveTo(list.querySelector('.nav-link.active:not(.ai-link)'));
        });
    }

    function initReveals() {
        const selectors = [
            '.feature-card',
            '.vehicle-card',
            '.destination-card',
            '.meetup-card',
            '.owner-card',
            '.why-rent-item',
            '.feed-post',
            '.community-stat-card',
            '.search-bar-wrapper',
            '.section-title',
            '.section-subtitle',
            '.filter-pills',
            '.explore-tabs-wrap',
            '.destination-hero',
            '.person-row',
            '.trust-item',
            '.auth-page .auth-visual-content',
            '.auth-page form'
        ].join(',');

        const nodes = Array.from(document.querySelectorAll(selectors));
        nodes.forEach((el, i) => {
            el.classList.add('reveal');
            el.style.setProperty('--reveal-delay', ((i % 6) * 70) + 'ms');
        });

        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('in');
                io.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });

        document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    }

    function initCardTilt() {
        document.querySelectorAll('.feature-card, .vehicle-card, .destination-card').forEach((card) => {
            card.addEventListener('mousemove', (e) => {
                const r = card.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width - 0.5;
                const y = (e.clientY - r.top) / r.height - 0.5;
                card.style.transform = 'translateY(-8px) rotateX(' + (-y * 7) + 'deg) rotateY(' + (x * 9) + 'deg)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    }
})();
