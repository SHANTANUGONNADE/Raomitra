document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('liveQuestions');
    const form = document.getElementById('communityForm');
    if (!list || !form) return;

    async function refresh() {
        try {
            const data = await RoamitraApi.get('/community/posts');
            const posts = data.posts || [];
            if (!posts.length) {
                list.innerHTML = '<p class="text-muted">No community questions yet. Be the first to ask.</p>';
                return;
            }
            list.innerHTML = posts.map(p => `
                <article class="feed-post live-post" data-id="${p.id}">
                    <div class="feed-post-header">
                        <div class="feed-post-avatar">${escapeHtml((p.full_name || '?').charAt(0))}</div>
                        <div class="feed-post-meta">
                            <div class="feed-post-name">${escapeHtml(p.full_name)}</div>
                            <div class="feed-post-time">${escapeHtml(p.created_at)} · ${p.reply_count} replies</div>
                        </div>
                    </div>
                    <h3 class="h6 mb-1">${escapeHtml(p.title)}</h3>
                    <p class="feed-post-content">${escapeHtml(p.body)}</p>
                    <form class="reply-form">
                        <label class="visually-hidden" for="reply-${p.id}">Reply</label>
                        <input id="reply-${p.id}" name="body" placeholder="Write a reply…" required>
                        <button type="submit" class="btn-roamitra btn-roamitra-navy btn-roamitra-sm">Reply</button>
                    </form>
                </article>
            `).join('');

            list.querySelectorAll('.reply-form').forEach(rf => {
                rf.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const postId = rf.closest('[data-id]').dataset.id;
                    const body = rf.body.value.trim();
                    try {
                        await RoamitraApi.post(`/community/posts/${postId}/replies`, { body });
                        rf.body.value = '';
                        await refresh();
                    } catch (err) {
                        if (err.status === 401) window.location.href = RoamitraApi.page('login.html');
                        else alert(err.message);
                    }
                });
            });
        } catch (e) {
            list.innerHTML = '<p class="text-muted">Could not load live questions.</p>';
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(form).entries());
        try {
            await RoamitraApi.post('/community/posts', payload);
            form.reset();
            await refresh();
        } catch (err) {
            if (err.status === 401) window.location.href = RoamitraApi.page('login.html');
            else alert(err.message);
        }
    });

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    refresh();
});
