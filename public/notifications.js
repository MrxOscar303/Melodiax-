// ============================================================
// Notification bell (navbar, Install App aur account ke darmiyan).
// Friend requests/accepts jaisi cheezon ki notification yahan dikhti hai.
// Har 25 second baad halka poll karta hai (unread count) - real-time
// Socket.io is Phase 1 mein shamil nahi, wo baad mein aayega.
// ============================================================
(function () {
    const API = '/api/notifications';
    const POLL_INTERVAL_MS = 25000;

    const wrap = document.getElementById('notif-bell-wrap');
    const bellBtn = document.getElementById('notif-bell-btn');
    const badge = document.getElementById('notif-bell-badge');
    const panel = document.getElementById('notif-panel');
    const list = document.getElementById('notif-list');
    const muteBtn = document.getElementById('notif-mute-btn');
    const markAllBtn = document.getElementById('notif-mark-all-btn');

    if (!wrap || !bellBtn) return;

    let pollTimer = null;
    let isMuted = false;

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    function timeAgo(dateStr) {
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    async function apiGet(path) {
        const res = await fetch(API + path, { credentials: 'include' });
        return res.json();
    }
    async function apiPatch(path, body) {
        const res = await fetch(API + path, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body || {}),
        });
        return res.json();
    }

    function setBadge(count) {
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
        // Tab title (Messages + Notifications dono ka combined "(N)" prefix)
        // window.melodiaxUpdateTabTitle isi file ke neeche ya messages-badge
        // wale hisse se milta hai - dono modules apna apna count report karte
        // hain aur wo function unhe jod kar title set kar deta hai.
        window.melodiaxNotifUnreadCount = count;
        if (window.melodiaxUpdateTabTitle) window.melodiaxUpdateTabTitle();
    }

    function setMuteUI(muted) {
        isMuted = muted;
        if (!muteBtn) return;
        muteBtn.innerHTML = muted
            ? '<i class="fa-solid fa-volume-xmark"></i>'
            : '<i class="fa-solid fa-volume-high"></i>';
        muteBtn.title = muted ? 'Unmute notifications' : 'Mute notifications';
        muteBtn.classList.toggle('notif-mute-active', muted);
    }

    function renderList(notifications) {
        if (!list) return;
        if (!notifications.length) {
            list.innerHTML = '<p class="notif-empty">No notifications yet.</p>';
            return;
        }
        list.innerHTML = notifications.map((n) => `
            <div class="notif-item ${n.read ? '' : 'notif-item-unread'}" data-id="${n.id}">
                <img src="${escapeHtml(n.fromUser ? n.fromUser.profilePicture : '/uploads/avatars/default-avatar.png')}" alt="" class="notif-avatar">
                <div class="notif-item-body">
                    <p class="notif-item-message">${escapeHtml(n.message)}</p>
                    <p class="notif-item-time">${timeAgo(n.createdAt)}</p>
                </div>
            </div>
        `).join('');

        list.querySelectorAll('.notif-item-unread').forEach((el) => {
            el.addEventListener('click', async () => {
                el.classList.remove('notif-item-unread');
                try {
                    await apiPatch(`/${el.getAttribute('data-id')}/read`);
                    refreshUnreadCount();
                } catch (err) { /* silent */ }
            });
        });
    }

    async function refreshUnreadCount() {
        try {
            const data = await apiGet('/unread-count');
            setBadge(data.count || 0);
        } catch (err) { /* silent */ }
    }

    async function loadNotifications() {
        try {
            const data = await apiGet('/');
            renderList(data.notifications || []);
            setMuteUI(data.muted === true);
        } catch (err) {
            if (list) list.innerHTML = '<p class="notif-empty">Could not load notifications.</p>';
        }
    }

    function openPanel() {
        panel.style.display = 'block';
        loadNotifications();
    }
    function closePanel() {
        panel.style.display = 'none';
    }

    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = panel.style.display === 'block';
        if (isOpen) closePanel(); else openPanel();
    });
    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) closePanel();
    });
    if (panel) panel.addEventListener('click', (e) => e.stopPropagation());

    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
            try {
                await apiPatch('/read-all');
                list.querySelectorAll('.notif-item-unread').forEach((el) => el.classList.remove('notif-item-unread'));
                setBadge(0);
            } catch (err) { /* silent */ }
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', async () => {
            const next = !isMuted;
            setMuteUI(next); // optimistic
            try {
                await fetch(API + '/mute', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ muted: next }),
                });
            } catch (err) {
                setMuteUI(!next); // fail hua to wapas ulta kar do
            }
        });
    }

    function startPolling() {
        stopPolling();
        refreshUnreadCount();
        pollTimer = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    }
    function stopPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
    }

    window.addEventListener('melodiax-auth-changed', () => {
        if (window.currentUser) {
            wrap.style.display = 'block';
            startPolling();
        } else {
            wrap.style.display = 'none';
            closePanel();
            stopPolling();
        }
    });
    if (window.currentUser) {
        wrap.style.display = 'block';
        startPolling();
    }
})();
