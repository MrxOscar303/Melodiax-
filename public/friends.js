// ============================================================
// Friend system frontend:
//   - Sidebar (home page, #friends-module): sirf friend count + list
//     dikhata hai (read-only, click kar ke chat khulti hai) - add-friend
//     yahan nahi hai.
//   - "Online" tab (#friends-view-section, top-nav "Online" button ya
//     mobile hamburger "Friends" se khulti hai - Playlist/Downloads/
//     Premium jaisa hi pattern): Add Friend, Requests, aur poori
//     friends list - sab yahan hai.
//   - Status: Online / Idle / Do Not Disturb / Invisible - khud
//     customize karta hai (Discord jaisa hi system).
// ============================================================
(function () {
    const API = '/api/friends';

    // ---------------- Heartbeat + auto Idle/Offline detection ----------------
    // Har 30 second (tab visible/focused hote hue) backend ko batate hain
    // "main abhi active hoon" - agar ye rukk jaye (tab/app band, internet
    // gaya), thodi der mein user doosron ko khud "offline" dikhne lagta hai
    // (backend staleness ke hisaab se calculate karta hai - routes/friends.js).
    //
    // Agar tab khuli hai lekin 5 minute se koi mouse/keyboard activity nahi
    // hui, to status khud "Idle" ho jata hai (agar manually DND/Invisible
    // set na kiya ho) - dobara activity hote hi wapas "Online".
    const HEARTBEAT_INTERVAL_MS = 30 * 1000;
    const IDLE_AFTER_MS = 5 * 60 * 1000;
    let heartbeatTimer = null;
    let idleCheckTimer = null;
    let lastActivityAt = Date.now();
    let isAutoIdle = false; // true = hum ne khud "night" laga diya inactivity ki wajah se (user ne khud nahi chuna)

    async function sendHeartbeat() {
        try { await fetch(API + '/heartbeat', { method: 'POST', credentials: 'include' }); } catch (err) { /* silent */ }
    }

    function markActivity() {
        lastActivityAt = Date.now();
        if (isAutoIdle && window.currentUser && window.currentUser.status === 'night') {
            isAutoIdle = false;
            setMyStatus('online', { silent: true });
        }
    }

    async function setMyStatus(status, opts = {}) {
        if (window.currentUser) window.currentUser.status = status;
        if (typeof window.melodiaxApplyProfileCardStatus === 'function') {
            window.melodiaxApplyProfileCardStatus(status, window.currentUser ? window.currentUser.statusMessage : '');
        }
        const dot = document.getElementById('my-status-dot');
        if (dot) setStatusDotClass(dot, status);
        if (!opts.silent) return;
        try {
            await fetch(API + '/status/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status, durationMinutes: 0 }),
            });
        } catch (err) { /* silent */ }
    }

    function checkIdle() {
        if (!window.currentUser) return;
        // Sirf tab hi auto-idle lagate hain jab user "online" par ho (khud
        // DND/Invisible/Idle na chuna ho) - manual choice ko kabhi override nahi karte.
        const currentlyAutoEligible = window.currentUser.status === 'online' || (isAutoIdle && window.currentUser.status === 'night');
        if (!currentlyAutoEligible) return;
        const idleFor = Date.now() - lastActivityAt;
        if (idleFor >= IDLE_AFTER_MS && !isAutoIdle) {
            isAutoIdle = true;
            setMyStatus('night', { silent: true });
        }
    }

    function startPresenceTracking() {
        stopPresenceTracking();
        sendHeartbeat();
        heartbeatTimer = setInterval(() => {
            if (document.visibilityState === 'visible') sendHeartbeat();
        }, HEARTBEAT_INTERVAL_MS);
        idleCheckTimer = setInterval(checkIdle, 15000);
        ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach((evt) => {
            document.addEventListener(evt, markActivity, { passive: true });
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') { markActivity(); sendHeartbeat(); }
        });
    }
    function stopPresenceTracking() {
        clearInterval(heartbeatTimer);
        clearInterval(idleCheckTimer);
        heartbeatTimer = null;
        idleCheckTimer = null;
    }
    // Jab bhi user khud (profile card se) koi status manually chune, us
    // choice ko auto-idle timer se "protect" karne ke liye ye flag reset
    // kar dete hain - warna agli activity par auto-revert-to-online ho
    // jata (jo sirf hamare khud lagaye "auto idle" ke liye theek hai).
    window.melodiaxResetAutoIdle = () => { isAutoIdle = false; };

    const friendsModule = document.getElementById('friends-module');
    const friendsListEl = document.getElementById('friends-list');
    const friendsCountEl = document.getElementById('friends-count');

    const friendsViewSection = document.getElementById('friends-view-section');
    const friendsViewListEl = document.getElementById('friends-view-list');
    const friendsViewCountEl = document.getElementById('friends-view-count');

    const addFriendInput = document.getElementById('add-friend-input');
    const sendFriendRequestBtn = document.getElementById('send-friend-request-btn');
    const addFriendSuggestions = document.getElementById('add-friend-suggestions');
    const addFriendFeedback = document.getElementById('add-friend-feedback');
    const friendRequestsSection = document.getElementById('friend-requests-section');
    const friendRequestsList = document.getElementById('friend-requests-list');

    const navOnlineBtn = document.getElementById('nav-online-btn');
    const homeIcon = document.querySelector('.home-icon');

    if (!friendsModule && !friendsViewSection) return;

    let searchDebounceTimer = null;

    // ---------------- Helpers ----------------
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    function statusLabel(status) {
        if (status === 'dnd') return 'Do Not Disturb';
        if (status === 'night') return 'Idle';
        if (status === 'invisible' || status === 'offline') return 'Offline';
        return 'Online';
    }

    // Status dot ke andar dnd/night ke liye chhota icon dalta hai (minus/moon) -
    // online plain green circle, invisible/offline hollow circle rehta hai.
    function statusDotInnerHtml(status) {
        if (status === 'dnd') return '<i class="fa-solid fa-minus"></i>';
        if (status === 'night') return '<i class="fa-solid fa-moon"></i>';
        return '';
    }

    // "invisible" khud apne liye hai; doosron ko backend khud hi "offline"
    // bhej deta hai (routes/friends.js me mask hota hai) - is liye yahan
    // dono cases (apna status "invisible" ho ya kisi friend ka "offline"
    // aaya ho) same visual dikhate hain.
    function statusDotClass(status) {
        if (status === 'invisible' || status === 'offline') return 'status-invisible';
        return `status-${status || 'online'}`;
    }

    function setStatusDotClass(el, status) {
        el.classList.remove('status-online', 'status-dnd', 'status-night', 'status-invisible');
        el.classList.add(statusDotClass(status));
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

    // ---------------- Render: friends list (sidebar + Online tab, dono) ----------------
    function friendItemHtml(f) {
        return `
            <div class="friend-item" data-friend-id="${f.id}" data-friend-username="${escapeHtml(f.username)}" data-friend-avatar="${escapeHtml(f.profilePicture)}" data-friend-status="${f.status || 'online'}" data-friend-status-message="${escapeHtml(f.statusMessage || '')}">
                <span class="friend-avatar-wrap">
                    <img src="${escapeHtml(f.profilePicture)}" alt="${escapeHtml(f.username)}" class="friend-avatar">
                    <span class="status-dot ${statusDotClass(f.status)}">${statusDotInnerHtml(f.status)}</span>
                </span>
                <span class="friend-info">
                    <span class="friend-username">@${escapeHtml(f.username)}</span>
                    <span class="friend-status-text">${f.statusMessage ? escapeHtml(f.statusMessage) : statusLabel(f.status)}</span>
                </span>
                <button type="button" class="friend-remove-btn" title="Remove friend" data-friendship-id="${f.friendshipId}">
                    <i class="fa-solid fa-user-xmark"></i>
                </button>
            </div>
        `;
    }

    function wireFriendItemEvents(container) {
        if (!container) return;
        container.querySelectorAll('.friend-item').forEach((item) => {
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
        container.querySelectorAll('.friend-remove-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
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

    function renderFriendsInto(container, countEl, friends) {
        if (!container) return;
        if (countEl) countEl.textContent = friends.length;
        if (!friends.length) {
            container.innerHTML = '<p class="friends-empty">No friends yet - add one using the "Online" tab.</p>';
            return;
        }
        container.innerHTML = friends.map(friendItemHtml).join('');
        wireFriendItemEvents(container);
    }

    function renderFriendsList(friends) {
        renderFriendsInto(friendsListEl, friendsCountEl, friends);
        renderFriendsInto(friendsViewListEl, friendsViewCountEl, friends);
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

    // ---------------- Add friend (ab sirf "Online" tab ke andar) ----------------
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

    // ---------------- My own status (Online / Idle / DND / Invisible + custom message) ----------------
    // Status change karne ka poora UI ab profile card ke andar hai
    // (profile.js handle karta hai) - yahan sirf sync karte hain: navbar
    // ke chhote status-dot ko, aur "custom status" bubble ko turant update
    // kar dete hain jab bhi kahin se (profile card se) status badle.
    function applyMyStatusToUI(status, statusMessage) {
        const dot = document.getElementById('my-status-dot');
        if (dot) setStatusDotClass(dot, status);
        if (typeof window.melodiaxApplyProfileCardStatus === 'function') {
            window.melodiaxApplyProfileCardStatus(status, statusMessage);
        }
        if (typeof window.melodiaxUpdateNavStatusBubble === 'function') {
            window.melodiaxUpdateNavStatusBubble(statusMessage);
        }
    }

    window.melodiaxApplyMyStatusToUI = applyMyStatusToUI; // profile.js se bhi use hota hai

    // ---------------- Login/logout wiring ----------------
    function refreshForLoggedIn() {
        if (friendsModule) friendsModule.style.display = 'block';
        if (navOnlineBtn) navOnlineBtn.style.display = '';
        applyMyStatusToUI(window.currentUser.status, window.currentUser.statusMessage);
        loadFriends();
        loadRequests();
        lastActivityAt = Date.now();
        isAutoIdle = false;
        startPresenceTracking();
    }

    window.addEventListener('melodiax-auth-changed', () => {
        if (window.currentUser) {
            refreshForLoggedIn();
        } else {
            if (friendsModule) friendsModule.style.display = 'none';
            if (navOnlineBtn) navOnlineBtn.style.display = 'none';
            if (friendRequestsSection) friendRequestsSection.style.display = 'none';
            stopPresenceTracking();
        }
    });
    if (window.currentUser) refreshForLoggedIn(); // race-condition safety agar event is script se pehle chal chuka ho

    // ---------------- "Online" tab open/close (Playlist/Downloads/Premium jaisa hi pattern) ----------------
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
        if (!window.currentUser) return;
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
    }

    if (navOnlineBtn) navOnlineBtn.addEventListener('click', showFriendsTab);
    if (homeIcon) homeIcon.addEventListener('click', hideFriendsTabInstant);

    // Doosre tabs (Playlist/Downloads/About/Premium/Chat) ko available
    // karwana taake wo bhi "Online" tab ko hide kar saken jab unpar switch
    // kiya jaye.
    window.melodiaxShowFriendsTab = showFriendsTab;
    window.melodiaxHideFriendsTab = hideFriendsTabInstant;
    window.melodiaxHideFriendsTabInstant = hideFriendsTabInstant;
})();
