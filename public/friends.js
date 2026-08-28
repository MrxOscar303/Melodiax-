// ============================================================
// Friend system frontend (Phase 1 - Foundation):
//   - Add/remove friend by @username, accept/decline requests
//   - Friends list with presence status (Online / Do Not Disturb / Night)
//   - User apna status khud customize karta hai (auto-detect nahi)
//   - Desktop: #friends-module hamesha sidebar me dikhta hai (home page)
//   - Mobile: wahi module #friends-view-section ke andar "move" ho jata hai
//     jab hamburger menu se "Friends" khola jaye (jaisa Playlist/About/
//     Premium tabs ka pattern hai)
// ============================================================
(function () {
    const API = '/api/friends';

    const friendsModule = document.getElementById('friends-module');
    if (!friendsModule) return;

    const addFriendToggleBtn = document.getElementById('add-friend-toggle-btn');
    const addFriendPanel = document.getElementById('add-friend-panel');
    const addFriendInput = document.getElementById('add-friend-input');
    const sendFriendRequestBtn = document.getElementById('send-friend-request-btn');
    const addFriendSuggestions = document.getElementById('add-friend-suggestions');
    const addFriendFeedback = document.getElementById('add-friend-feedback');
    const friendRequestsSection = document.getElementById('friend-requests-section');
    const friendRequestsList = document.getElementById('friend-requests-list');
    const friendsListEl = document.getElementById('friends-list');
    const friendsCountEl = document.getElementById('friends-count');

    const friendsViewSection = document.getElementById('friends-view-section');
    const friendsViewMount = document.getElementById('friends-view-mount');
    const homeIcon = document.querySelector('.home-icon');

    const myStatusMessageInput = document.getElementById('my-status-message-input');

    const friendsModuleOriginalParent = friendsModule.parentElement;
    const friendsModuleOriginalNextSibling = friendsModule.nextSibling;

    let searchDebounceTimer = null;
    let statusMsgDebounce = null;

    // ---------------- Helpers ----------------
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    function statusLabel(status) {
        if (status === 'dnd') return 'Do Not Disturb';
        if (status === 'night') return 'Night';
        return 'Online';
    }

    // Status dot ke andar dnd/night ke liye chhota icon dalta hai (minus/moon) -
    // online plain green circle hi rehta hai.
    function statusDotInnerHtml(status) {
        if (status === 'dnd') return '<i class="fa-solid fa-minus"></i>';
        if (status === 'night') return '<i class="fa-solid fa-moon"></i>';
        return '';
    }

    function setStatusDotClass(el, status) {
        el.classList.remove('status-online', 'status-dnd', 'status-night');
        el.classList.add(`status-${status || 'online'}`);
        el.innerHTML = statusDotInnerHtml(status);
    }

    async function apiGet(path) {
        const res = await fetch(API + path, { credentials: 'include' });
        return res.json();
    }
    async function apiPost(path, body) {
        const res = await fetch(API + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body || {}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Something went wrong');
        return data;
    }
    async function apiPatch(path, body) {
        const res = await fetch(API + path, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body || {}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Something went wrong');
        return data;
    }
    async function apiDelete(path) {
        const res = await fetch(API + path, { method: 'DELETE', credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Something went wrong');
        return data;
    }

    // ---------------- Render: friends list ----------------
    function renderFriendsList(friends) {
        if (!friendsListEl) return;
        if (friendsCountEl) friendsCountEl.textContent = friends.length;
        if (!friends.length) {
            friendsListEl.innerHTML = '<p class="friends-empty">No friends yet - add one with their @username above.</p>';
            return;
        }
        friendsListEl.innerHTML = friends.map((f) => `
            <div class="friend-item" data-friend-id="${f.id}" data-friend-username="${escapeHtml(f.username)}" data-friend-avatar="${escapeHtml(f.profilePicture)}" data-friend-status="${f.status || 'online'}" data-friend-status-message="${escapeHtml(f.statusMessage || '')}">
                <span class="friend-avatar-wrap">
                    <img src="${escapeHtml(f.profilePicture)}" alt="${escapeHtml(f.username)}" class="friend-avatar">
                    <span class="status-dot status-${f.status || 'online'}">${statusDotInnerHtml(f.status)}</span>
                </span>
                <span class="friend-info">
                    <span class="friend-username">@${escapeHtml(f.username)}</span>
                    <span class="friend-status-text">${f.statusMessage ? escapeHtml(f.statusMessage) : statusLabel(f.status)}</span>
                </span>
                <button type="button" class="friend-remove-btn" title="Remove friend" data-friendship-id="${f.friendshipId}">
                    <i class="fa-solid fa-user-xmark"></i>
                </button>
            </div>
        `).join('');

        friendsListEl.querySelectorAll('.friend-item').forEach((item) => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.friend-remove-btn')) return;
                if (typeof window.melodiaxOpenChat === 'function') {
                    window.melodiaxOpenChat({
                        id: item.getAttribute('data-friend-id'),
                        username: item.getAttribute('data-friend-username'),
                        profilePicture: item.getAttribute('data-friend-avatar'),
                        status: item.getAttribute('data-friend-status'),
                        statusMessage: item.getAttribute('data-friend-status-message'),
                    });
                }
            });
        });

        friendsListEl.querySelectorAll('.friend-remove-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!window.confirm('Remove this friend?')) return;
                try {
                    await apiDelete('/' + btn.getAttribute('data-friendship-id'));
                    loadFriends();
                } catch (err) {
                    window.alert(err.message);
                }
            });
        });
    }

    // ---------------- Render: incoming requests ----------------
    function renderRequests(requests) {
        if (!friendRequestsList || !friendRequestsSection) return;
        if (!requests.length) {
            friendRequestsSection.style.display = 'none';
            friendRequestsList.innerHTML = '';
            return;
        }
        friendRequestsSection.style.display = 'block';
        friendRequestsList.innerHTML = requests.map((r) => `
            <div class="friend-request-item">
                <img src="${escapeHtml(r.from.profilePicture)}" alt="${escapeHtml(r.from.username)}" class="friend-avatar">
                <span class="friend-username">@${escapeHtml(r.from.username)}</span>
                <div class="friend-request-actions">
                    <button type="button" class="friend-request-accept" data-id="${r.id}" title="Accept"><i class="fa-solid fa-check"></i></button>
                    <button type="button" class="friend-request-decline" data-id="${r.id}" title="Decline"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
        `).join('');

        friendRequestsList.querySelectorAll('.friend-request-accept').forEach((btn) => {
            btn.addEventListener('click', async () => {
                try {
                    await apiPost(`/requests/${btn.getAttribute('data-id')}/accept`);
                    loadRequests();
                    loadFriends();
                } catch (err) { window.alert(err.message); }
            });
        });
        friendRequestsList.querySelectorAll('.friend-request-decline').forEach((btn) => {
            btn.addEventListener('click', async () => {
                try {
                    await apiPost(`/requests/${btn.getAttribute('data-id')}/decline`);
                    loadRequests();
                } catch (err) { window.alert(err.message); }
            });
        });
    }

    async function loadFriends() {
        try {
            const data = await apiGet('/');
            renderFriendsList(data.friends || []);
        } catch (err) { /* silent - network hiccup, list ko purani halat me hi rehne do */ }
    }

    async function loadRequests() {
        try {
            const data = await apiGet('/requests');
            renderRequests(data.requests || []);
        } catch (err) { /* silent */ }
    }

    // ---------------- Add friend panel ----------------
    if (addFriendToggleBtn) {
        addFriendToggleBtn.addEventListener('click', () => {
            const isOpen = addFriendPanel.style.display === 'block';
            addFriendPanel.style.display = isOpen ? 'none' : 'block';
            if (!isOpen && addFriendInput) addFriendInput.focus();
            if (addFriendFeedback) addFriendFeedback.textContent = '';
            if (addFriendSuggestions) addFriendSuggestions.innerHTML = '';
        });
    }

    function renderSuggestions(users) {
        if (!addFriendSuggestions) return;
        if (!users.length) { addFriendSuggestions.innerHTML = ''; return; }
        addFriendSuggestions.innerHTML = users.map((u) => `
            <div class="add-friend-suggestion" data-username="${escapeHtml(u.username)}">
                <img src="${escapeHtml(u.profilePicture)}" alt="" class="friend-avatar">
                <span>@${escapeHtml(u.username)}</span>
            </div>
        `).join('');
        addFriendSuggestions.querySelectorAll('.add-friend-suggestion').forEach((el) => {
            el.addEventListener('click', () => {
                addFriendInput.value = '@' + el.getAttribute('data-username');
                addFriendSuggestions.innerHTML = '';
                addFriendInput.focus();
            });
        });
    }

    if (addFriendInput) {
        addFriendInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            const q = addFriendInput.value.trim().replace(/^@/, '');
            if (q.length < 2) { addFriendSuggestions.innerHTML = ''; return; }
            searchDebounceTimer = setTimeout(async () => {
                try {
                    const data = await apiGet('/search?q=' + encodeURIComponent(q));
                    renderSuggestions(data.users || []);
                } catch (err) { /* silent */ }
            }, 300);
        });
        addFriendInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); sendRequest(); }
        });
    }

    async function sendRequest() {
        if (!addFriendInput || !addFriendFeedback) return;
        const username = addFriendInput.value.trim();
        if (!username) return;
        addFriendFeedback.textContent = 'Sending...';
        addFriendFeedback.className = 'add-friend-feedback';
        try {
            const data = await apiPost('/request', { username });
            addFriendFeedback.textContent = data.message;
            addFriendFeedback.classList.add('add-friend-feedback-success');
            addFriendInput.value = '';
            addFriendSuggestions.innerHTML = '';
        } catch (err) {
            addFriendFeedback.textContent = err.message;
            addFriendFeedback.classList.add('add-friend-feedback-error');
        }
    }
    if (sendFriendRequestBtn) sendFriendRequestBtn.addEventListener('click', sendRequest);

    // ---------------- My own status (Online / DND / Night + custom message) ----------------
    function applyMyStatusToUI(status, statusMessage) {
        const dot = document.getElementById('my-status-dot');
        if (dot) setStatusDotClass(dot, status);
        if (myStatusMessageInput) myStatusMessageInput.value = statusMessage || '';
        document.querySelectorAll('.my-status-option').forEach((btn) => {
            btn.classList.toggle('active', btn.getAttribute('data-status') === status);
        });
    }

    document.querySelectorAll('.my-status-option').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const status = btn.getAttribute('data-status');
            applyMyStatusToUI(status, myStatusMessageInput ? myStatusMessageInput.value : '');
            try {
                await apiPatch('/status/me', { status });
                if (window.currentUser) window.currentUser.status = status;
                loadFriends(); // apna status friends ki list mein bhi turant reflect ho (agar khud ko dekh rahe hon kahin)
            } catch (err) { /* silent */ }
        });
    });

    if (myStatusMessageInput) {
        myStatusMessageInput.addEventListener('click', (e) => e.stopPropagation());
        myStatusMessageInput.addEventListener('input', () => {
            clearTimeout(statusMsgDebounce);
            statusMsgDebounce = setTimeout(async () => {
                try {
                    await apiPatch('/status/me', { statusMessage: myStatusMessageInput.value });
                    if (window.currentUser) window.currentUser.statusMessage = myStatusMessageInput.value;
                } catch (err) { /* silent */ }
            }, 600);
        });
    }

    // ---------------- Login/logout wiring ----------------
    function refreshForLoggedIn() {
        friendsModule.style.display = 'block';
        applyMyStatusToUI(window.currentUser.status, window.currentUser.statusMessage);
        loadFriends();
        loadRequests();
    }

    window.addEventListener('melodiax-auth-changed', () => {
        if (window.currentUser) {
            refreshForLoggedIn();
        } else {
            friendsModule.style.display = 'none';
            if (friendRequestsSection) friendRequestsSection.style.display = 'none';
            if (addFriendPanel) addFriendPanel.style.display = 'none';
        }
    });
    if (window.currentUser) refreshForLoggedIn(); // race-condition safety agar event is script se pehle chal chuka ho

    // ---------------- Mobile view: fade + move module in/out ----------------
    function fadeOutThen(elements, after) {
        const visible = elements.filter((el) => el && el.style.display !== 'none');
        if (!visible.length) { after(); return; }
        visible.forEach((el) => el.classList.add('view-hidden'));
        setTimeout(after, 220);
    }
    function fadeIn(elements) {
        elements.forEach((el) => { if (el) el.classList.add('view-hidden'); });
        if (elements[0]) void elements[0].offsetWidth;
        requestAnimationFrame(() => {
            elements.forEach((el) => { if (el) el.classList.remove('view-hidden'); });
        });
    }

    function showFriendsTab() {
        if (typeof window.melodiaxSetHomeBannerVisible === 'function') window.melodiaxSetHomeBannerVisible(false);
        if (typeof window.melodiaxHideDownloadsTab === 'function') window.melodiaxHideDownloadsTab();
        if (typeof window.melodiaxHideAboutTabInstant === 'function') window.melodiaxHideAboutTabInstant();
        if (typeof window.melodiaxHidePremiumTabInstant === 'function') window.melodiaxHidePremiumTabInstant();
        if (typeof window.melodiaxHideChatTabInstant === 'function') window.melodiaxHideChatTabInstant();

        const homeSections = Array.from(document.querySelectorAll('.main-right-part > .music-section'));
        const playlistsSection = document.getElementById('playlists-view-section');
        const downloadsSection = document.getElementById('downloads-view-section');

        fadeOutThen([...homeSections, playlistsSection, downloadsSection], () => {
            homeSections.forEach((sec) => { sec.style.display = 'none'; });
            if (playlistsSection) playlistsSection.style.display = 'none';
            if (downloadsSection) downloadsSection.style.display = 'none';

            if (friendsViewMount && friendsModule.parentElement !== friendsViewMount) {
                friendsViewMount.appendChild(friendsModule);
            }
            friendsModule.style.display = window.currentUser ? 'block' : 'none';
            if (friendsViewSection) {
                friendsViewSection.style.display = 'block';
                fadeIn([friendsViewSection]);
            }
            loadFriends();
            loadRequests();
        });
    }

    // Turant (bina fade ke) chupata hai - jab koi doosra tab khule to ye call hota hai.
    function hideFriendsTabInstant() {
        if (friendsViewSection) friendsViewSection.style.display = 'none';
        if (friendsModule.parentElement !== friendsModuleOriginalParent) {
            friendsModuleOriginalParent.insertBefore(friendsModule, friendsModuleOriginalNextSibling);
            friendsModule.style.display = window.currentUser ? 'block' : 'none';
        }
    }

    if (homeIcon) homeIcon.addEventListener('click', hideFriendsTabInstant);

    // Doosre tabs (Playlist/Downloads/About/Premium) ko available karwana
    // taake wo bhi Friends tab ko hide kar saken jab unpar switch kiya jaye.
    window.melodiaxShowFriendsTab = showFriendsTab;
    window.melodiaxHideFriendsTab = hideFriendsTabInstant;
    window.melodiaxHideFriendsTabInstant = hideFriendsTabInstant;
})();
