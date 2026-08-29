// ============================================================
// Profile card - avatar YA username, dono par click karne se khulti hai
// (hover se koi dropdown ab nahi khulta). Discord-jaisa card:
//   Banner (customizable color) -> Avatar -> Username (edit, 1x/week) ->
//   Bio -> Status (4 options, smooth animation) -> Member since -> Logout
//
// Chhota "custom status" bubble bhi navbar ke avatar ke neeche dikhta hai
// (jab status message set ho), jo isi card se edit/clear hota hai.
// ============================================================
(function () {
    const modal = document.getElementById('profile-modal');
    const closeBtn = document.getElementById('profile-modal-close-btn');
    const userAvatarBtn = document.getElementById('user-avatar');
    const userNameBtn = document.getElementById('user-name');

    const banner = document.getElementById('profile-banner');
    const bannerColorBtn = document.getElementById('profile-banner-color-btn');
    const bannerColorPicker = document.getElementById('profile-banner-color-picker');
    const bannerColorInput = document.getElementById('profile-banner-color-input');

    const cardAvatar = document.getElementById('profile-card-avatar');
    const cardStatusDot = document.getElementById('profile-card-status-dot');
    const avatarEditBtn = document.getElementById('profile-card-avatar-edit-btn');
    const avatarInput = document.getElementById('profile-edit-avatar-input');

    const cardUsername = document.getElementById('profile-card-username');
    const usernameEditBtn = document.getElementById('profile-card-username-edit-btn');
    const usernameEditRow = document.getElementById('profile-username-edit-row');
    const usernameInput = document.getElementById('profile-edit-username');
    const usernameSaveBtn = document.getElementById('profile-username-save-btn');
    const usernameCancelBtn = document.getElementById('profile-username-cancel-btn');
    const usernameFeedback = document.getElementById('profile-username-feedback');
    const cardHandleText = document.getElementById('profile-card-handle-text');
    const copyHandleBtn = document.getElementById('profile-card-copy-handle-btn');

    const bioInput = document.getElementById('profile-edit-bio');
    const bioFeedback = document.getElementById('profile-bio-feedback');

    const statusOptionsWrap = document.getElementById('profile-card-status-options');
    const statusMessageInput = document.getElementById('profile-card-status-message-input');
    const statusClearBtn = document.getElementById('profile-status-clear-btn');

    const memberSinceDateEl = document.getElementById('profile-member-since-date');

    const navStatusBubble = document.getElementById('nav-status-bubble');
    const navStatusBubbleText = document.getElementById('nav-status-bubble-text');

    if (!modal || !userAvatarBtn) return;

    let selectedAvatarFile = null;

    // ---------------- Status helpers (shared visual language) ----------------
    function statusDotInnerHtml(status) {
        if (status === 'dnd') return '<i class="fa-solid fa-minus"></i>';
        if (status === 'night') return '<i class="fa-solid fa-moon"></i>';
        return '';
    }
    function setStatusDotClass(el, status) {
        el.classList.remove('status-online', 'status-dnd', 'status-night', 'status-invisible');
        el.classList.add(`status-${status || 'online'}`);
        el.innerHTML = statusDotInnerHtml(status);
    }

    function applyStatusToCard(status, statusMessage) {
        if (cardStatusDot) {
            setStatusDotClass(cardStatusDot, status);
            // Smooth "pop" animation har status change par
            cardStatusDot.classList.remove('status-pop');
            void cardStatusDot.offsetWidth;
            cardStatusDot.classList.add('status-pop');
        }
        if (statusMessageInput) statusMessageInput.value = statusMessage || '';
        if (statusClearBtn) statusClearBtn.style.display = statusMessage ? 'flex' : 'none';
        if (statusOptionsWrap) {
            statusOptionsWrap.querySelectorAll('.profile-status-option').forEach((btn) => {
                const isActive = btn.getAttribute('data-status') === status;
                btn.classList.toggle('active', isActive);
            });
        }
    }
    window.melodiaxApplyProfileCardStatus = applyStatusToCard; // friends.js se bhi sync hota hai

    // ---------------- Nav status bubble (avatar ke neeche, navbar mein) ----------------
    function updateNavStatusBubble(statusMessage) {
        if (!navStatusBubble || !navStatusBubbleText) return;
        const msg = (statusMessage || '').trim();
        if (msg) {
            navStatusBubbleText.textContent = msg;
            navStatusBubble.style.display = 'block';
            navStatusBubble.classList.remove('nav-status-bubble-show');
            void navStatusBubble.offsetWidth;
            navStatusBubble.classList.add('nav-status-bubble-show');
        } else {
            navStatusBubble.classList.remove('nav-status-bubble-show');
            setTimeout(() => { navStatusBubble.style.display = 'none'; }, 200);
        }
    }
    window.melodiaxUpdateNavStatusBubble = updateNavStatusBubble;

    async function patchStatus(body) {
        const res = await fetch('/api/friends/status/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
        });
        return res.json();
    }

    if (statusOptionsWrap) {
        statusOptionsWrap.querySelectorAll('.profile-status-option').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const status = btn.getAttribute('data-status');
                applyStatusToCard(status, statusMessageInput ? statusMessageInput.value : '');
                if (window.currentUser) window.currentUser.status = status;
                if (typeof window.melodiaxApplyMyStatusToUI === 'function') {
                    window.melodiaxApplyMyStatusToUI(status, statusMessageInput ? statusMessageInput.value : '');
                }
                try { await patchStatus({ status }); } catch (err) { /* silent */ }
            });
        });
    }

    let statusMsgDebounce = null;
    if (statusMessageInput) {
        statusMessageInput.addEventListener('input', () => {
            if (statusClearBtn) statusClearBtn.style.display = statusMessageInput.value ? 'flex' : 'none';
            clearTimeout(statusMsgDebounce);
            statusMsgDebounce = setTimeout(async () => {
                const val = statusMessageInput.value;
                if (window.currentUser) window.currentUser.statusMessage = val;
                updateNavStatusBubble(val);
                if (typeof window.melodiaxApplyMyStatusToUI === 'function') {
                    window.melodiaxApplyMyStatusToUI(window.currentUser ? window.currentUser.status : 'online', val);
                }
                try { await patchStatus({ statusMessage: val }); } catch (err) { /* silent */ }
            }, 600);
        });
    }
    if (statusClearBtn) {
        statusClearBtn.addEventListener('click', async () => {
            statusMessageInput.value = '';
            statusClearBtn.style.display = 'none';
            if (window.currentUser) window.currentUser.statusMessage = '';
            updateNavStatusBubble('');
            try { await patchStatus({ statusMessage: '' }); } catch (err) { /* silent */ }
        });
    }

    // ---------------- Open / close modal ----------------
    function formatMemberSince(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function openModal() {
        if (!window.currentUser) return;
        const u = window.currentUser;

        if (banner) banner.style.backgroundColor = u.bannerColor || '#1db954';
        if (bannerColorInput) bannerColorInput.value = u.bannerColor || '#1db954';
        if (bannerColorPicker) bannerColorPicker.style.display = 'none';

        cardAvatar.src = u.profilePicture || '/uploads/avatars/default-avatar.png';
        selectedAvatarFile = null;

        cardUsername.textContent = u.username;
        cardHandleText.textContent = u.username;
        usernameInput.value = u.username || '';
        usernameEditRow.style.display = 'none';
        usernameFeedback.textContent = '';
        usernameFeedback.className = 'profile-edit-feedback';

        bioInput.value = u.bio || '';
        bioFeedback.textContent = '';

        applyStatusToCard(u.status, u.statusMessage);
        memberSinceDateEl.textContent = formatMemberSince(u.memberSince);

        modal.style.display = 'block';
    }

    function closeModal() {
        modal.style.display = 'none';
        if (bannerColorPicker) bannerColorPicker.style.display = 'none';
    }

    userAvatarBtn.addEventListener('click', (e) => { e.stopPropagation(); openModal(); });
    if (userNameBtn) userNameBtn.addEventListener('click', (e) => { e.stopPropagation(); openModal(); });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // ---------------- Banner color ----------------
    async function saveBannerColor(color) {
        if (banner) banner.style.backgroundColor = color;
        if (window.currentUser) window.currentUser.bannerColor = color;
        try {
            const formData = new FormData();
            formData.append('bannerColor', color);
            await fetch('/api/auth/me', { method: 'PATCH', credentials: 'include', body: formData });
        } catch (err) { /* silent */ }
    }
    if (bannerColorBtn) {
        bannerColorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            bannerColorPicker.style.display = bannerColorPicker.style.display === 'flex' ? 'none' : 'flex';
        });
    }
    if (bannerColorPicker) {
        bannerColorPicker.addEventListener('click', (e) => e.stopPropagation());
        bannerColorPicker.querySelectorAll('.banner-color-swatch').forEach((sw) => {
            sw.addEventListener('click', () => saveBannerColor(sw.getAttribute('data-color')));
        });
    }
    if (bannerColorInput) {
        bannerColorInput.addEventListener('input', () => saveBannerColor(bannerColorInput.value));
    }

    // ---------------- Avatar (camera icon on card) ----------------
    if (avatarEditBtn) avatarEditBtn.addEventListener('click', () => avatarInput.click());
    if (avatarInput) {
        avatarInput.addEventListener('change', async () => {
            const file = avatarInput.files[0];
            if (!file) return;
            selectedAvatarFile = file;
            const reader = new FileReader();
            reader.onload = (ev) => { cardAvatar.src = ev.target.result; };
            reader.readAsDataURL(file);

            const formData = new FormData();
            formData.append('profilePicture', file);
            try {
                const res = await fetch('/api/auth/me', { method: 'PATCH', credentials: 'include', body: formData });
                const data = await res.json();
                if (res.ok) {
                    window.currentUser = data.user;
                    window.dispatchEvent(new CustomEvent('melodiax-auth-changed'));
                    const navAvatar = document.getElementById('user-avatar');
                    if (navAvatar) navAvatar.src = data.user.profilePicture;
                }
            } catch (err) { /* silent */ }
        });
    }

    // ---------------- Username (inline edit, 1x/week) ----------------
    if (usernameEditBtn) {
        usernameEditBtn.addEventListener('click', () => {
            usernameInput.value = window.currentUser.username;
            usernameEditRow.style.display = 'flex';
            usernameFeedback.textContent = '';
            usernameInput.focus();
        });
    }
    if (usernameCancelBtn) {
        usernameCancelBtn.addEventListener('click', () => {
            usernameEditRow.style.display = 'none';
            usernameFeedback.textContent = '';
        });
    }
    if (usernameSaveBtn) {
        usernameSaveBtn.addEventListener('click', async () => {
            const newUsername = usernameInput.value.trim();
            if (newUsername.length < 3) {
                usernameFeedback.textContent = 'Username must be at least 3 characters.';
                usernameFeedback.className = 'profile-edit-feedback profile-edit-feedback-error';
                return;
            }
            if (newUsername === window.currentUser.username) {
                usernameEditRow.style.display = 'none';
                return;
            }
            usernameSaveBtn.disabled = true;
            usernameFeedback.textContent = 'Saving...';
            usernameFeedback.className = 'profile-edit-feedback';
            try {
                const formData = new FormData();
                formData.append('username', newUsername);
                const res = await fetch('/api/auth/me', { method: 'PATCH', credentials: 'include', body: formData });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Could not update username.');

                window.currentUser = data.user;
                window.dispatchEvent(new CustomEvent('melodiax-auth-changed'));
                cardUsername.textContent = data.user.username;
                cardHandleText.textContent = data.user.username;
                const navName = document.getElementById('user-name');
                if (navName) navName.textContent = data.user.username;

                usernameFeedback.textContent = 'Username updated!';
                usernameFeedback.className = 'profile-edit-feedback profile-edit-feedback-success';
                setTimeout(() => { usernameEditRow.style.display = 'none'; usernameFeedback.textContent = ''; }, 900);
            } catch (err) {
                usernameFeedback.textContent = err.message;
                usernameFeedback.className = 'profile-edit-feedback profile-edit-feedback-error';
            } finally {
                usernameSaveBtn.disabled = false;
            }
        });
    }

    // ---------------- Bio (auto-save on blur) ----------------
    if (bioInput) {
        bioInput.addEventListener('blur', async () => {
            const bio = bioInput.value.trim();
            if (window.currentUser && bio === (window.currentUser.bio || '')) return;
            bioFeedback.textContent = 'Saving...';
            bioFeedback.className = 'profile-edit-feedback';
            try {
                const formData = new FormData();
                formData.append('bio', bio);
                const res = await fetch('/api/auth/me', { method: 'PATCH', credentials: 'include', body: formData });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Could not save bio.');
                window.currentUser = data.user;
                bioFeedback.textContent = 'Saved!';
                bioFeedback.className = 'profile-edit-feedback profile-edit-feedback-success';
                setTimeout(() => { bioFeedback.textContent = ''; }, 1200);
            } catch (err) {
                bioFeedback.textContent = err.message;
                bioFeedback.className = 'profile-edit-feedback profile-edit-feedback-error';
            }
        });
    }

    // ---------------- Copy handle ----------------
    if (copyHandleBtn) {
        copyHandleBtn.addEventListener('click', async () => {
            if (!window.currentUser) return;
            const handle = '@' + window.currentUser.username;
            try { await navigator.clipboard.writeText(handle); } catch (err) { /* clipboard blocked - not critical */ }
            const icon = copyHandleBtn.querySelector('i');
            const original = icon.className;
            icon.className = 'fa-solid fa-check';
            setTimeout(() => { icon.className = original; }, 1200);
        });
    }

    // Page load par (agar already logged in ho) status bubble turant sahi dikhe
    window.addEventListener('melodiax-auth-changed', () => {
        if (window.currentUser) updateNavStatusBubble(window.currentUser.statusMessage);
        else updateNavStatusBubble('');
    });
    if (window.currentUser) updateNavStatusBubble(window.currentUser.statusMessage);
})();
